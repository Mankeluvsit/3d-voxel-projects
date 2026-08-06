export type Terrain = "water" | "sand" | "grass" | "rock";
export type Zone = "none" | "road" | "residential" | "commercial" | "industrial" | "park";

export interface Tile {
  h: number;
  terrain: Terrain;
  zone: Zone;
  /** Development level 0..5 for zoned tiles. */
  level: number;
  pop: number;
  jobs: number;
  tree: boolean;
  /** Rolling traffic density 0..1 for road tiles. */
  traffic: number;
  /** Growth progress accumulator. */
  grow: number;
}

export interface World {
  size: number;
  seed: number;
  tiles: Tile[];
}

export interface Demand {
  r: number;
  c: number;
  i: number;
}

export interface GameState {
  world: World;
  money: number;
  population: number;
  jobs: number;
  day: number;
  /** 0..1 fraction of the current day, drives the sun. */
  dayTime: number;
  tick: number;
  demand: Demand;
  lastIncome: number;
}

export type Overlay = "none" | "traffic" | "zones";

export interface HudStats {
  money: number;
  population: number;
  jobs: number;
  day: number;
  income: number;
  demand: Demand;
  speed: number;
  tool: string;
  overlay: Overlay;
  cars: number;
  selected: SelectedInfo | null;
  ready: boolean;
  message: string | null;
}

export interface SelectedInfo {
  x: number;
  z: number;
  terrain: Terrain;
  zone: Zone;
  level: number;
  pop: number;
  jobs: number;
  height: number;
  traffic: number;
  hasRoad: boolean;
}
