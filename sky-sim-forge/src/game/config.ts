export const GRID = 64;
/** Height of one voxel step in world units. */
export const BLOCK_H = 0.35;
/** Terrain heights are integers 0..MAX_H. */
export const MAX_H = 14;
export const SEA_LEVEL = 4;
/** Simulation ticks per second at speed 1. */
export const TICK_HZ = 4;
/** Ticks that make up one in-game day. */
export const TICKS_PER_DAY = 12;
export const MAX_CARS = 260;
export const START_MONEY = 25000;

export type ToolId =
  | "select"
  | "bulldoze"
  | "raise"
  | "lower"
  | "road"
  | "residential"
  | "commercial"
  | "industrial"
  | "park";

export interface ToolDef {
  id: ToolId;
  label: string;
  short: string;
  cost: number;
  key: string;
  hint: string;
}

export const TOOLS: ToolDef[] = [
  { id: "select", label: "Inspect", short: "SEL", cost: 0, key: "1", hint: "Drag to pan. Click a tile to inspect it." },
  { id: "bulldoze", label: "Bulldoze", short: "DEL", cost: 10, key: "2", hint: "Clear roads, zones and trees." },
  { id: "raise", label: "Raise", short: "UP", cost: 40, key: "3", hint: "Raise terrain one step." },
  { id: "lower", label: "Lower", short: "DWN", cost: 40, key: "4", hint: "Lower terrain one step." },
  { id: "road", label: "Road", short: "RD", cost: 25, key: "5", hint: "Drag to lay road. Zones need a road." },
  { id: "residential", label: "Housing", short: "RES", cost: 100, key: "6", hint: "Homes grow where jobs are near." },
  { id: "commercial", label: "Shops", short: "COM", cost: 130, key: "7", hint: "Shops create jobs and taxes." },
  { id: "industrial", label: "Industry", short: "IND", cost: 160, key: "8", hint: "Factories create lots of jobs." },
  { id: "park", label: "Park", short: "PRK", cost: 60, key: "9", hint: "Parks raise nearby land value." },
];

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;
