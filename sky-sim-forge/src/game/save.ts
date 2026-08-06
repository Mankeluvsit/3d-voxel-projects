import type { GameState, Tile, Zone } from "./types";
import { terrainFor } from "./world";

const KEY = "voxelcity.saves.v1";
const SAVE_VERSION = 1;

export interface SaveSlot {
  name: string;
  savedAt: number;
  day: number;
  population: number;
  data: SavePayload;
}

interface SavePayload {
  v: number;
  seed: number;
  size: number;
  money: number;
  day: number;
  dayTime: number;
  h: number[];
  zone: number[];
  level: number[];
  tree: number[];
}

const ZONES: Zone[] = ["none", "road", "residential", "commercial", "industrial", "park"];

export function serialize(state: GameState): SavePayload {
  const { world } = state;
  return {
    v: SAVE_VERSION,
    seed: world.seed,
    size: world.size,
    money: Math.round(state.money),
    day: state.day,
    dayTime: state.dayTime,
    h: world.tiles.map((t) => t.h),
    zone: world.tiles.map((t) => ZONES.indexOf(t.zone)),
    level: world.tiles.map((t) => t.level),
    tree: world.tiles.map((t) => (t.tree ? 1 : 0)),
  };
}

export function deserialize(payload: SavePayload, state: GameState): GameState {
  const size = payload.size;
  const tiles: Tile[] = new Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const h = payload.h[i] ?? 0;
    tiles[i] = {
      h,
      terrain: terrainFor(h),
      zone: ZONES[payload.zone[i] ?? 0] ?? "none",
      level: payload.level[i] ?? 0,
      pop: 0,
      jobs: 0,
      tree: !!payload.tree[i],
      traffic: 0,
      grow: 0,
    };
  }
  state.world = { size, seed: payload.seed, tiles };
  state.money = payload.money;
  state.day = payload.day;
  state.dayTime = payload.dayTime ?? 0.3;
  state.tick = 0;
  return state;
}

function readAll(): SaveSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SaveSlot[]) : [];
  } catch {
    return [];
  }
}

export function listSaves(): SaveSlot[] {
  return readAll()
    .filter((s) => s?.data?.v === SAVE_VERSION)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function writeSave(name: string, state: GameState) {
  if (typeof window === "undefined") return;
  const slots = readAll().filter((s) => s.name !== name);
  slots.unshift({
    name,
    savedAt: Date.now(),
    day: state.day,
    population: Math.round(state.population),
    data: serialize(state),
  });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slots.slice(0, 8)));
  } catch {
    /* quota exceeded — ignore, autosave will retry */
  }
}

export function deleteSave(name: string) {
  if (typeof window === "undefined") return;
  const slots = readAll().filter((s) => s.name !== name);
  window.localStorage.setItem(KEY, JSON.stringify(slots));
}

export const AUTOSAVE_NAME = "Autosave";
