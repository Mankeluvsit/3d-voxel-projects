import { MAX_CARS } from "./config";
import type { World } from "./types";
import { idx, neighbors4 } from "./world";

export interface Car {
  path: number[];
  seg: number;
  t: number;
  speed: number;
  color: number;
}

/** A* over the road-tile graph. Returns tile indices or null. */
export function findPath(world: World, start: number, goal: number): number[] | null {
  if (start === goal) return [start];
  const size = world.size;
  const tiles = world.tiles;
  if (tiles[start].zone !== "road" || tiles[goal].zone !== "road") return null;

  const gx = goal % size;
  const gz = (goal / size) | 0;
  const open: number[] = [start];
  const gScore = new Map<number, number>([[start, 0]]);
  const fScore = new Map<number, number>([[start, 0]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  let guard = 0;

  while (open.length && guard++ < 20000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if ((fScore.get(open[i]) ?? Infinity) < (fScore.get(open[bi]) ?? Infinity)) bi = i;
    }
    const current = open.splice(bi, 1)[0];
    if (current === goal) {
      const path = [current];
      let c = current;
      while (cameFrom.has(c)) {
        c = cameFrom.get(c)!;
        path.push(c);
      }
      return path.reverse();
    }
    closed.add(current);

    const cx = current % size;
    const cz = (current / size) | 0;
    for (const [nx, nz] of neighbors4(cx, cz, size)) {
      const ni = idx(nx, nz, size);
      if (tiles[ni].zone !== "road" || closed.has(ni)) continue;
      // Congested roads cost more, so cars naturally spread out.
      const cost = 1 + tiles[ni].traffic * 2.5;
      const tentative = (gScore.get(current) ?? Infinity) + cost;
      if (tentative < (gScore.get(ni) ?? Infinity)) {
        cameFrom.set(ni, current);
        gScore.set(ni, tentative);
        fScore.set(ni, tentative + Math.abs(nx - gx) + Math.abs(nz - gz));
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }
  return null;
}

const CAR_COLORS = [0xe8503a, 0xf2c14e, 0x4fb0e8, 0xf5f2e8, 0x6fcf5f, 0xb05ce8, 0x2f3542];

export class TrafficSystem {
  cars: Car[] = [];
  private spawnAcc = 0;

  reset() {
    this.cars = [];
  }

  /** Drop cars whose route no longer exists (roads were bulldozed). */
  validate(world: World) {
    this.cars = this.cars.filter((car) => car.path.every((i) => world.tiles[i].zone === "road"));
  }

  update(world: World, dt: number, sources: number[], sinks: number[], rng: () => number) {
    // Spawn.
    const target = Math.min(MAX_CARS, Math.floor(sources.length * 1.6) + 4);
    this.spawnAcc += dt * 7;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.cars.length >= target || !sources.length || !sinks.length) break;
      const a = sources[(rng() * sources.length) | 0];
      const b = sinks[(rng() * sinks.length) | 0];
      if (a === b) continue;
      const path = findPath(world, a, b);
      if (!path || path.length < 2) continue;
      this.cars.push({
        path,
        seg: 0,
        t: 0,
        speed: 2.6 + rng() * 1.6,
        color: CAR_COLORS[(rng() * CAR_COLORS.length) | 0],
      });
    }

    // Move + measure density.
    const density = new Float32Array(world.tiles.length);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const here = car.path[car.seg];
      const congestion = world.tiles[here]?.traffic ?? 0;
      car.t += dt * car.speed * (1 - Math.min(0.72, congestion * 0.85));
      while (car.t >= 1) {
        car.t -= 1;
        car.seg++;
        if (car.seg >= car.path.length - 1) break;
      }
      if (car.seg >= car.path.length - 1) {
        this.cars.splice(i, 1);
        continue;
      }
      density[car.path[car.seg]] += 1;
    }

    // Smooth traffic values towards observed density.
    const k = Math.min(1, dt * 1.5);
    for (let i = 0; i < world.tiles.length; i++) {
      const tile = world.tiles[i];
      if (tile.zone !== "road") {
        tile.traffic = 0;
        continue;
      }
      const d = Math.min(1, density[i] / 3);
      tile.traffic += (d - tile.traffic) * k;
    }
  }
}
