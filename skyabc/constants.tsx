/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { BuildingConfig, BuildingType, BuildingCategory } from './types';

// Map Settings
export const GRID_SIZE = 15;

// Game Settings
export const TICK_RATE_MS = 2000; // Game loop updates every 2 seconds
export const INITIAL_MONEY = 1000;

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  [BuildingType.None]: {
    type: BuildingType.None,
    category: BuildingCategory.Infrastructure,
    cost: 0,
    name: 'Bulldoze',
    description: 'Clear a tile',
    color: '#ef4444', // Used for UI
    popGen: 0,
    incomeGen: 0,
    unlockLevel: 1,
  },
  [BuildingType.Road]: {
    type: BuildingType.Road,
    category: BuildingCategory.Infrastructure,
    cost: 10,
    name: 'Road',
    description: 'Connects buildings.',
    color: '#374151', // gray-700
    popGen: 0,
    incomeGen: 0,
    unlockLevel: 1,
  },
  [BuildingType.Residential]: {
    type: BuildingType.Residential,
    category: BuildingCategory.Residential,
    cost: 100,
    name: 'House',
    description: '+5 Pop/day',
    color: '#f87171', // red-400
    popGen: 5,
    incomeGen: 0,
    unlockLevel: 1,
  },
  [BuildingType.Commercial]: {
    type: BuildingType.Commercial,
    category: BuildingCategory.Commercial,
    cost: 200,
    name: 'Shop',
    description: '+$15/day',
    color: '#60a5fa', // blue-400
    popGen: 0,
    incomeGen: 15,
    unlockLevel: 2,
  },
  [BuildingType.Industrial]: {
    type: BuildingType.Industrial,
    category: BuildingCategory.Industrial,
    cost: 400,
    name: 'Factory',
    description: '+$40/day',
    color: '#facc15', // yellow-400
    popGen: 0,
    incomeGen: 40,
    unlockLevel: 3,
  },
  [BuildingType.Park]: {
    type: BuildingType.Park,
    category: BuildingCategory.Decoration,
    cost: 50,
    name: 'Park',
    description: 'Looks nice.',
    color: '#4ade80', // green-400
    popGen: 1,
    incomeGen: 0,
    unlockLevel: 2,
  },
  [BuildingType.PoliceStation]: {
    type: BuildingType.PoliceStation,
    category: BuildingCategory.Infrastructure,
    cost: 500,
    name: 'Police',
    description: 'Reduces crime.',
    color: '#3b82f6', // blue-500
    popGen: 0,
    incomeGen: -20,
    unlockLevel: 4,
  },
  [BuildingType.FireStation]: {
    type: BuildingType.FireStation,
    category: BuildingCategory.Infrastructure,
    cost: 500,
    name: 'Fire',
    description: 'Prevents fires.',
    color: '#ef4444', // red-500
    popGen: 0,
    incomeGen: -20,
    unlockLevel: 4,
  },
  [BuildingType.Hospital]: {
    type: BuildingType.Hospital,
    category: BuildingCategory.Infrastructure,
    cost: 600,
    name: 'Hospital',
    description: 'Heals citizens.',
    color: '#ffffff', // white
    popGen: 0,
    incomeGen: -30,
    unlockLevel: 5,
  },
  [BuildingType.Water]: {
    type: BuildingType.Water,
    category: BuildingCategory.Infrastructure,
    cost: 0,
    name: 'Water',
    description: 'A river.',
    color: '#3b82f6',
    popGen: 0,
    incomeGen: 0,
    unlockLevel: 1,
  },
};
