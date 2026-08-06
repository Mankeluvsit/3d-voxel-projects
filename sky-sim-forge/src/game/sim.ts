import { START_MONEY, TICKS_PER_DAY } from "./config";
import { hash2 } from "./rng";
import type { GameState, World, Zone } from "./types";
import { generateWorld, hasRoadAccess, idx, neighbors4 } from "./world";

export function createState(seed: number): GameState {
  return {
    world: generateWorld(seed),
    money: START_MONEY,
    population: 0,
    jobs: 0,
    day: 1,
    dayTime: 0.42,
    tick: 0,
    demand: { r: 0.8, c: 0.3, i: 0.4 },
    lastIncome: 0,
  };
}

const CAPACITY: Record<Zone, number> = {
  none: 0,
  road: 0,
  park: 0,
  residential: 14,
  commercial: 10,
  industrial: 16,
};

function amenity(world: World, x: number, z: number) {
  // Parks and low traffic nearby make a tile more desirable.
  let score = 0;
  const r = 3;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= world.size || nz >= world.size) continue;
      const t = world.tiles[idx(nx, nz, world.size)];
      if (t.zone === "park") score += 0.09;
      if (t.zone === "industrial") score -= 0.05;
      if (t.tree) score += 0.012;
    }
  }
  return Math.max(-0.5, Math.min(0.6, score));
}

/** One simulation step. Mutates state; returns true when meshes need a rebuild. */
export function step(state: GameState): boolean {
  const world = state.world;
  const size = world.size;
  let dirty = false;

  state.tick++;
  state.dayTime += 1 / TICKS_PER_DAY;
  if (state.dayTime >= 1) {
    state.dayTime -= 1;
    state.day++;
  }

  let pop = 0;
  let jobs = 0;
  let residentialCap = 0;
  let jobCap = 0;

  const dayEnd = state.tick % TICKS_PER_DAY === 0;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, z, size);
      const tile = world.tiles[i];
      const zone = tile.zone;
      if (zone === "none" || zone === "road") continue;

      if (zone === "park") {
        if (tile.level < 1) {
          tile.level = 1;
          dirty = true;
        }
        continue;
      }

      const road = hasRoadAccess(world, x, z);
      const cap = CAPACITY[zone];
      if (zone === "residential") residentialCap += cap * 5;
      else jobCap += cap * 5;

      const want =
        zone === "residential" ? state.demand.r : zone === "commercial" ? state.demand.c : state.demand.i;

      if (road) {
        const congestion = neighbors4(x, z, size).reduce((acc, [nx, nz]) => {
          const n = world.tiles[idx(nx, nz, size)];
          return n.zone === "road" ? Math.max(acc, n.traffic) : acc;
        }, 0);
        const pressure = want + amenity(world, x, z) - congestion * 0.55;
        tile.grow += pressure * 0.06;
      } else {
        tile.grow -= 0.03;
      }

      if (tile.grow > 1 && tile.level < 5) {
        tile.grow = 0;
        tile.level++;
        dirty = true;
      } else if (tile.grow < -1 && tile.level > 0) {
        tile.grow = 0;
        tile.level--;
        dirty = true;
      }
      tile.grow = Math.max(-1.4, Math.min(1.4, tile.grow));

      const filled = tile.level * cap;
      if (zone === "residential") tile.pop = filled;
      else tile.jobs = filled;

      pop += tile.pop;
      jobs += tile.jobs;
    }
  }

  state.population = pop;
  state.jobs = jobs;

  // Demand balances homes against jobs, with a floor so a new city can start.
  const jobRatio = pop === 0 ? 1 : jobs / Math.max(1, pop * 0.55);
  state.demand.r = clamp(0.25 + (jobRatio - 1) * 0.9 + (residentialCap === 0 ? 0.6 : 0));
  const workerRatio = jobs === 0 ? 1 : (pop * 0.55) / Math.max(1, jobs);
  state.demand.c = clamp(0.15 + (workerRatio - 1) * 0.8 + (jobCap === 0 ? 0.5 : 0));
  state.demand.i = clamp(0.1 + (workerRatio - 1) * 0.95 + (jobCap === 0 ? 0.55 : 0));

  if (dayEnd) {
    const taxes = Math.round(pop * 1.4 + jobs * 1.1);
    const upkeep = Math.round(countRoads(world) * 0.6);
    state.lastIncome = taxes - upkeep;
    state.money += state.lastIncome;
  }

  return dirty;
}

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

function countRoads(world: World) {
  let n = 0;
  for (const t of world.tiles) if (t.zone === "road") n++;
  return n;
}

/** Road tiles next to populated homes (trip origins) and to jobs (destinations). */
export function tripEndpoints(world: World) {
  const sources: number[] = [];
  const sinks: number[] = [];
  const size = world.size;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const tile = world.tiles[idx(x, z, size)];
      if (tile.level === 0) continue;
      const roads = neighbors4(x, z, size)
        .map(([nx, nz]) => idx(nx, nz, size))
        .filter((i) => world.tiles[i].zone === "road");
      if (!roads.length) continue;
      const pick = roads[(hash2(x, z, 91) * roads.length) | 0];
      if (tile.zone === "residential") sources.push(pick);
      else if (tile.zone === "commercial" || tile.zone === "industrial") sinks.push(pick);
    }
  }
  return { sources, sinks };
}
