import { GRID, MAX_H, SEA_LEVEL } from "./config";
import { fbm, hash2 } from "./rng";
import type { Terrain, Tile, World } from "./types";

export function idx(x: number, z: number, size = GRID) {
  return z * size + x;
}

export function inBounds(x: number, z: number, size = GRID) {
  return x >= 0 && z >= 0 && x < size && z < size;
}

export function terrainFor(h: number): Terrain {
  if (h <= SEA_LEVEL) return "water";
  if (h <= SEA_LEVEL + 1) return "sand";
  if (h >= SEA_LEVEL + 6) return "rock";
  return "grass";
}

export function emptyTile(h: number): Tile {
  return {
    h,
    terrain: terrainFor(h),
    zone: "none",
    level: 0,
    pop: 0,
    jobs: 0,
    tree: false,
    traffic: 0,
    grow: 0,
  };
}

export function generateWorld(seed: number, size = GRID): World {
  const tiles: Tile[] = new Array(size * size);
  const half = size / 2;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const nx = x / 18;
      const nz = z / 18;
      const base = fbm(nx, nz, seed, 5);
      const ridge = Math.abs(fbm(nx * 0.55 + 40, nz * 0.55 - 20, seed + 7777, 3) - 0.5) * 2;

      // Falloff so the map edges fade into ocean.
      const dx = (x - half + 0.5) / half;
      const dz = (z - half + 0.5) / half;
      const d = Math.min(1, Math.sqrt(dx * dx + dz * dz) / 1.05);
      const falloff = 1 - d * d * d;

      let v = base * 0.75 + ridge * 0.35;
      v = v * falloff - 0.06;
      const h = Math.max(0, Math.min(MAX_H, Math.round(v * MAX_H * 1.45)));

      const tile = emptyTile(h);
      if (tile.terrain === "grass") {
        const t = hash2(x, z, seed + 31337);
        const density = fbm(x / 9, z / 9, seed + 555, 2);
        tile.tree = t < density * 0.42;
      }
      tiles[idx(x, z, size)] = tile;
    }
  }

  return { size, seed, tiles };
}

export function neighbors4(x: number, z: number, size = GRID) {
  const out: Array<[number, number]> = [];
  if (x > 0) out.push([x - 1, z]);
  if (x < size - 1) out.push([x + 1, z]);
  if (z > 0) out.push([x, z - 1]);
  if (z < size - 1) out.push([x, z + 1]);
  return out;
}

export function hasRoadAccess(world: World, x: number, z: number) {
  for (const [nx, nz] of neighbors4(x, z, world.size)) {
    if (world.tiles[idx(nx, nz, world.size)].zone === "road") return true;
  }
  return false;
}

export function adjacentRoad(world: World, x: number, z: number): number | null {
  for (const [nx, nz] of neighbors4(x, z, world.size)) {
    const i = idx(nx, nz, world.size);
    if (world.tiles[i].zone === "road") return i;
  }
  return null;
}

export function isBuildable(world: World, x: number, z: number) {
  const t = world.tiles[idx(x, z, world.size)];
  if (t.terrain === "water") return false;
  // Reject steep tiles: max height difference with 4-neighbours must be <= 1.
  for (const [nx, nz] of neighbors4(x, z, world.size)) {
    if (Math.abs(world.tiles[idx(nx, nz, world.size)].h - t.h) > 1) return false;
  }
  return true;
}
