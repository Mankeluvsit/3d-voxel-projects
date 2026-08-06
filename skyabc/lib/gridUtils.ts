import { Grid, TileData, BuildingType, BiomeType } from '../types';

export const getSeededRandom = (seed: number) => {
  let a = (seed + 1) | 0;
  let b = (seed ^ 0x1234) | 0;
  let c = (seed ^ 0x5678) | 0;
  let d = (seed ^ 0x9abc) | 0;
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    var t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
};

export const createInitialGrid = (size: number, seed: number = 0, mapTheme: string = 'temperate'): Grid => {
  const grid: Grid = [];
  const rand = getSeededRandom(seed);
  
  // 1. Generate Biome Map with theme-based textures
  let defaultBiome = BiomeType.Grass;
  if (mapTheme === 'desert') {
    defaultBiome = BiomeType.Sand;
  }
  
  const biomeMap = Array.from({length: size}, () => Array.from({length: size}, () => defaultBiome));
  
  // Add some random clusters
  const clusterCount = Math.floor(rand() * 4) + 6;
  for (let i = 0; i < clusterCount; i++) {
    const rx = Math.floor(rand() * size);
    const ry = Math.floor(rand() * size);
    // Desert gets brown dirt details, winter/grass gets sand & dirt details
    const type = rand() > 0.5 ? BiomeType.Dirt : (mapTheme === 'desert' ? BiomeType.Dirt : BiomeType.Sand);
    // Spread
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (rx + dx >= 0 && rx + dx < size && ry + dy >= 0 && ry + dy < size) {
           if (rand() > 0.45) biomeMap[ry + dy][rx + dx] = type;
        }
      }
    }
  }

  for (let y = 0; y < size; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < size; x++) {
      row.push({ x, y, buildingType: BuildingType.None, biome: biomeMap[y][x] });
    }
    grid.push(row);
  }
  
  // Generate a simple river
  let startX, startY, endX, endY;
  const edge = Math.floor(rand() * 4);
  
  if (edge === 0) { startX = Math.floor(rand() * size); startY = 0; endX = Math.floor(rand() * size); endY = size - 1; }
  else if (edge === 1) { startX = Math.floor(rand() * size); startY = size - 1; endX = Math.floor(rand() * size); endY = 0; }
  else if (edge === 2) { startX = 0; startY = Math.floor(rand() * size); endX = size - 1; endY = Math.floor(rand() * size); }
  else { startX = size - 1; startY = Math.floor(rand() * size); endX = 0; endY = Math.floor(rand() * size); }
  
  let currentX = startX;
  let currentY = startY;
  
  for (let i = 0; i < size * 3; i++) {
    if (currentY >= 0 && currentY < size && currentX >= 0 && currentX < size) {
        grid[currentY][currentX].buildingType = BuildingType.Water;
        grid[currentY][currentX].biome = BiomeType.Water; 
        grid[currentY][currentX].isWater = true;
        
        // Thicken the river somewhat
        if (currentX + 1 < size) {
            grid[currentY][currentX + 1].buildingType = BuildingType.Water;
            grid[currentY][currentX + 1].biome = BiomeType.Water;
            grid[currentY][currentX + 1].isWater = true;
        }
        if (currentY + 1 < size) {
            grid[currentY + 1][currentX].buildingType = BuildingType.Water;
            grid[currentY + 1][currentX].biome = BiomeType.Water;
            grid[currentY + 1][currentX].isWater = true;
        }
    }
    
    // Move towards end point with noise
    if (currentX < endX) currentX += rand() > 0.35 ? 1 : 0;
    else if (currentX > endX) currentX -= rand() > 0.35 ? 1 : 0;
    
    if (currentY < endY) currentY += rand() > 0.35 ? 1 : 0;
    else if (currentY > endY) currentY -= rand() > 0.35 ? 1 : 0;
    
    // Add some random scatter
    if (rand() > 0.5) currentX += rand() > 0.5 ? 1 : -1;
    else currentY += rand() > 0.5 ? 1 : -1;
    
    if (currentX === endX && currentY === endY) break;
  }
  
  return grid;
};

export const checkRoadAdjacency = (x: number, y: number, grid: Grid, size: number): boolean => {
  const dirs = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 }
  ];
  for (const d of dirs) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      if (grid[ny][nx].buildingType === BuildingType.Road) {
        return true;
      }
    }
  }
  return false;
};
