/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export enum BuildingType {
  None = 'None',
  Road = 'Road',
  Residential = 'Residential',
  Commercial = 'Commercial',
  Industrial = 'Industrial',
  Park = 'Park',
  PoliceStation = 'PoliceStation',
  FireStation = 'FireStation',
  Hospital = 'Hospital',
  Water = 'Water',
}

export enum BuildingCategory {
  Infrastructure = 'Infrastructure',
  Residential = 'Residential',
  Commercial = 'Commercial',
  Industrial = 'Industrial',
  Decoration = 'Decoration',
}

export enum BiomeType {
  Grass = 'Grass',
  Dirt = 'Dirt',
  Sand = 'Sand',
  Mountain = 'Mountain',
  Water = 'Water',
}

export interface BuildingConfig {
  type: BuildingType;
  category: BuildingCategory;
  cost: number;
  name: string;
  description: string;
  color: string; // Main color for 3D material
  popGen: number; // Population generation per tick
  incomeGen: number; // Money generation per tick
  unlockLevel: number;
}

export interface TileData {
  x: number;
  y: number;
  buildingType: BuildingType;
  biome: BiomeType;
  variant?: number;
  isWater?: boolean;
  rotation?: number; // 0, 90, 180, 270 degrees
  efficiency?: number; // 0 to 1
  lifetimeIncome?: number; // Total money generated
  isBridge?: boolean;
}

export interface FeatureIdea {
  id: string;
  text: string;
  category: 'Infrastructure' | 'Economy' | 'Environment' | 'Recreation';
}

export type Grid = TileData[][];

export interface CityStats {
  money: number;
  population: number;
  day: number;
  level: number;
  xp: number;
}

export interface AIGoal {
  description: string;
  targetType: 'population' | 'money' | 'building_count';
  targetValue: number;
  buildingType?: BuildingType; // If target is building_count
  reward: number;
  completed: boolean;
}

export interface NewsItem {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}