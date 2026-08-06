import * as THREE from "three";
import type { Terrain, Zone } from "../types";

export const TERRAIN_TOP: Record<Terrain, number> = {
  water: 0x2f6690,
  sand: 0xe6cf9b,
  grass: 0x6ab04a,
  rock: 0x8d8b84,
};

export const TERRAIN_SIDE: Record<Terrain, number> = {
  water: 0x24506f,
  sand: 0xc2a874,
  grass: 0x7a5a34,
  rock: 0x6e6c66,
};

export const ZONE_COLOR: Record<Zone, number> = {
  none: 0x000000,
  road: 0x3c3f47,
  residential: 0x57c85a,
  commercial: 0x3fa9f5,
  industrial: 0xf2b134,
  park: 0x2f9e6d,
};

export const WATER_COLOR = 0x2b6ea8;
export const ROAD_COLOR = 0x35383f;
export const ROAD_LINE = 0xd8d3b8;

export function shade(hex: number, amount: number) {
  const c = new THREE.Color(hex);
  if (amount >= 0) c.lerp(new THREE.Color(0xffffff), amount);
  else c.lerp(new THREE.Color(0x000000), -amount);
  return c;
}
