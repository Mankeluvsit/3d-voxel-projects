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
  Extractor = 'Extractor',
}

export interface BuildingConfig {
  type: BuildingType;
  cost: number;
  name: string;
  description: string;
  color: string; // Main color for 3D material
  popGen: number; // Population generation per tick
  incomeGen: number; // Money generation per tick
}

export interface TileData {
  x: number;
  y: number;
  buildingType: BuildingType;
  // Suggested by AI for visual variety later
  variant?: number;
  resourceType?: 'Energy' | 'Water' | 'Mineral';
  isPowered?: boolean;
  hasWater?: boolean;
  isIncomeGenerating?: boolean;
}

export interface ResourceNode {
  x: number;
  y: number;
  type: 'Energy' | 'Water' | 'Mineral';
}

export interface MapConfig {
  width: number;
  height: number;
  resources: ResourceNode[];
}

export type Grid = TileData[][];

export interface CityStats {
  money: number;
  population: number;
  day: number;
  energyProduction?: number;
  energyDemand?: number;
  waterProduction?: number;
  waterDemand?: number;
  mineralProduction?: number;
  taxRate?: number; // percentage value e.g. 10 for 10%
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

export interface MusicComposition {
  tempo: number;
  scale: string;
  synthType: 'amsynth' | 'fmsynth' | 'duosynth' | 'plucksynth';
  notes: {
    time: string;
    note: string;
    duration: string;
  }[];
}

export interface MusicTrack {
  id: string;
  url?: string;
  composition?: MusicComposition;
  prompt: string;
  lyrics?: string;
  timestamp: number;
  type: 'lyria' | 'procedural';
}

export type IdeaCategory = 'Gameplay' | 'AI' | 'Visuals' | 'Economics' | 'Social' | 'Other';

export type LODLevel = 'High' | 'Medium' | 'Low';

export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  lodLevel: LODLevel;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  category: IdeaCategory;
  impact: number; // 1-10
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'Draft' | 'Approved' | 'Implemented';
  timestamp: number;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
