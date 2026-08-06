import * as THREE from 'three';
import { GRID_SIZE } from '../constants';

export const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
export const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];

export const getHash = (x: number, y: number) => Math.abs(Math.sin((x + 1.1) * 12.9898 + (y + 1.1) * 78.233) * 43758.5453) % 1;
export const getRandomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
export const coneGeo = new THREE.ConeGeometry(1, 1, 4);
export const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
