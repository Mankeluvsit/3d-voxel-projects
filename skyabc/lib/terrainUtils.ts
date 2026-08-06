import { getHash } from './3dUtils';
import { Grid } from '../types';

export const terrainConfig = {
  theme: 'temperate',
  ruggedness: 1.5,
  seed: 0,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Simple Value Noise for smooth rolling hills
export const smoothNoise = (nx: number, ny: number) => {
    const ix = Math.floor(nx);
    const iy = Math.floor(ny);
    const fx = nx - ix;
    const fy = ny - iy;

    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);

    const a = getHash(ix, iy);
    const b = getHash(ix + 1, iy);
    const c = getHash(ix, iy + 1);
    const d = getHash(ix + 1, iy + 1);

    return lerp(lerp(a, b, u), lerp(c, d, u), v);
};

export const getTerrainHeight = (px: number, py: number, grid?: Grid) => {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    
    if (grid && iy >= 0 && iy < grid.length && ix >= 0 && ix < grid[0].length) {
        if (grid[iy][ix].isWater) {
            return -0.45; 
        }
    }

    const seedShift = (terrainConfig.seed || 0) * 11.37;

    const hillNoise = smoothNoise(px * 0.08 + seedShift, py * 0.08 + seedShift); 
    const medNoise = smoothNoise(px * 0.3 + seedShift, py * 0.3 + seedShift);
    const detailNoise = smoothNoise(px * 1.2 + seedShift, py * 1.2 + seedShift);
    
    // Elevation calculation
    let rawElevation = (hillNoise * 1.0) + (medNoise * 0.35) + (detailNoise * 0.1); 
    let elevation = rawElevation / 1.45; 
    
    // Shape the terrain to have rolling hills & distinct mountain peaks
    elevation = Math.pow(Math.max(0, elevation), 1.6);
    
    const ruggednessScale = terrainConfig.ruggedness !== undefined ? terrainConfig.ruggedness : 1.5;
    
    // Scale height verticality
    return -0.4 + (elevation * ruggednessScale);
};
