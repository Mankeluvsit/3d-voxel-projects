/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { MapControls, Environment, SoftShadows, Instance, Instances, Float, useTexture, Outlines, OrthographicCamera, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { Grid, BuildingType, TileData, BiomeType } from '../types';
import { GRID_SIZE, BUILDINGS } from '../constants';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

// --- Constants & Helpers ---
import { WORLD_OFFSET, gridToWorld, getHash, getRandomRange, boxGeo, cylinderGeo, coneGeo, sphereGeo } from '../lib/3dUtils';
import { terrainConfig, getTerrainHeight } from '../lib/terrainUtils';

// Stable static materials to prevent shader compilation overhead and leaks
const POLE_GRAY_MAT = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.6 });
const BOX_DARK_MAT = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.8 });
const ROAD_YELLOW_MAT = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 1.0 });

// Warehouse material
const SHELF_GRAY_MAT = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.7 });

// Park materials
const PARK_GRAVEL_MAT = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.9 });
const PARK_POOL_MAT = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.1, metalness: 0.8 });
const PARK_TRUNK_MAT = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });

// Clutter global static materials
const CLUTTER_MATERIALS = {
  desertRock: new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 }),
  desertCactus: new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.9 }),
  winterRock: new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.8 }),
  winterTrunk: new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }),
  winterFoliage: new THREE.MeshStandardMaterial({ color: '#065f46', flatShading: true }),
  winterSnow: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true }),
  temperateRock: new THREE.MeshStandardMaterial({ color: '#78716c', roughness: 0.8 }),
  temperateTrunk: new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }),
  temperateLeaves: new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9, flatShading: true }),
  temperateConifer: new THREE.MeshStandardMaterial({ color: '#022c22', roughness: 0.9, flatShading: true }),
};

// Global material cache for procedural buildings to optimize draw calls and shader memory
const buildingMaterialCache: Record<string, THREE.MeshStandardMaterial> = {};
const getCachedMaterial = (color: THREE.Color | string, suffix: string, opacity: number, transparent: boolean, config: Partial<THREE.MeshStandardMaterialParameters>) => {
  const colorHex = typeof color === 'string' ? color : (color as THREE.Color).getHexString();
  const key = `${colorHex}-${suffix}-${opacity}-${transparent}-${JSON.stringify(config)}`;
  if (!buildingMaterialCache[key]) {
    buildingMaterialCache[key] = new THREE.MeshStandardMaterial({
      color: typeof color === 'string' ? new THREE.Color(color) : color.clone(),
      opacity,
      transparent,
      ...config
    });
  }
  return buildingMaterialCache[key];
};

// Blinking Red Warning Beacon Light for skyscrapers
const BlinkingMaterial = React.memo(() => {
    const matRef = useRef<THREE.MeshStandardMaterial>(null);
    useFrame((state) => {
        if (!matRef.current) return;
        const active = Math.floor(state.clock.elapsedTime * 2) % 2 === 0;
        matRef.current.emissiveIntensity = active ? 1.5 : 0.1;
    });
    return <meshStandardMaterial ref={matRef} color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} roughness={0.2} />;
});

// --- Object Pooling System for frequently spawned 3D building models ---
const meshInstancesPool: Record<string, THREE.Mesh[]> = {};

const getMeshFromPool = (geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh => {
  const key = `${geometry.uuid}-${material.uuid}`;
  if (!meshInstancesPool[key]) {
    meshInstancesPool[key] = [];
  }
  const pool = meshInstancesPool[key];
  if (pool.length > 0) {
    const mesh = pool.pop()!;
    mesh.visible = true;
    return mesh;
  }
  return new THREE.Mesh(geometry, material);
};

const releaseMeshToPool = (mesh: THREE.Mesh, geometry: THREE.BufferGeometry, material: THREE.Material) => {
  const key = `${geometry.uuid}-${material.uuid}`;
  if (!meshInstancesPool[key]) {
    meshInstancesPool[key] = [];
  }
  mesh.visible = false;
  mesh.removeFromParent();
  meshInstancesPool[key].push(mesh);
};

interface PooledMeshProps {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  position?: [number, number, number];
  scale?: [number, number, number] | number;
  rotation?: [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

const PooledMesh: React.FC<PooledMeshProps> = React.memo(({
  geometry,
  material,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  castShadow = false,
  receiveShadow = false
}) => {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const mesh = getMeshFromPool(geometry, material);
    meshRef.current = mesh;

    return () => {
      if (mesh) {
        releaseMeshToPool(mesh, geometry, material);
      }
    };
  }, [geometry, material]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.position.set(...position);
      if (typeof scale === 'number') {
        mesh.scale.set(scale, scale, scale);
      } else {
        mesh.scale.set(...scale);
      }
      mesh.rotation.set(...rotation);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
    }
  }, [position, scale, rotation, castShadow, receiveShadow]);

  if (!meshRef.current) return null;
  return <primitive object={meshRef.current} />;
});

// --- LOD Context ---
import { LODContext } from '../lib/contexts';

// --- Animation Helpers ---
const AnimatedPart = React.memo(({ geometry, material, position, scale, rotationSpeed = 0 }: any) => {
    const ref = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if(ref.current) {
            ref.current.rotation.y += rotationSpeed || 0;
        }
    });
    return <mesh ref={ref} geometry={geometry} material={material} position={position} scale={scale} castShadow />;
});

// Static Materials for Traffic lights
const STATIC_RED_LIGHT_MAT = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ff0000', emissiveIntensity: 0.6 });
const STATIC_YELLOW_LIGHT_MAT = new THREE.MeshStandardMaterial({ color: '#eab308', emissive: '#ffff00', emissiveIntensity: 0.2 });
const STATIC_GREEN_LIGHT_MAT = new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#00ff00', emissiveIntensity: 0.2 });

const SingleTrafficPole = React.memo(({ rotation }: { rotation: [number, number, number] }) => (
    <group rotation={rotation}>
        <group position={[0.3, 0, 0.3]}>
            <mesh geometry={cylinderGeo} material={POLE_GRAY_MAT} scale={[0.02, 1.2, 0.02]} position={[0, 0.6, 0]} />
            <mesh geometry={cylinderGeo} material={POLE_GRAY_MAT} scale={[0.015, 0.4, 0.015]} position={[-0.2, 1.15, 0]} rotation={[0, 0, Math.PI/2]} />
            <group position={[-0.2, 0.95, 0]}>
                <mesh geometry={boxGeo} material={BOX_DARK_MAT} scale={[0.08, 0.25, 0.08]} />
                <mesh geometry={sphereGeo} material={STATIC_RED_LIGHT_MAT} scale={0.03} position={[0, 0.08, 0.04]} />
                <mesh geometry={sphereGeo} material={STATIC_YELLOW_LIGHT_MAT} scale={0.03} position={[0, 0, 0.04]} />
                <mesh geometry={sphereGeo} material={STATIC_GREEN_LIGHT_MAT} scale={0.03} position={[0, -0.08, 0.04]} />
            </group>
        </group>
    </group>
));

const TrafficLight = React.memo(({ hasUp, hasDown, hasLeft, hasRight }: { hasUp: boolean, hasDown: boolean, hasLeft: boolean, hasRight: boolean }) => (
    <group>
        {hasDown && <SingleTrafficPole rotation={[0, 0, 0]} />}
        {hasUp && <SingleTrafficPole rotation={[0, Math.PI, 0]} />}
        {hasRight && <SingleTrafficPole rotation={[0, Math.PI/2, 0]} />}
        {hasLeft && <SingleTrafficPole rotation={[0, -Math.PI/2, 0]} />}
    </group>
));





// --- 1. Advanced Procedural Buildings ---

const SmokeStack = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.children.forEach((child, i) => {
        const cloud = child as THREE.Mesh;
        cloud.position.y += 0.01 + i * 0.005;
        cloud.scale.addScalar(0.005);
        
        const material = cloud.material as THREE.MeshStandardMaterial;
        if (material) {
          material.opacity -= 0.005;
          if (cloud.position.y > 1.5) {
            cloud.position.y = 0;
            cloud.scale.setScalar(0.1 + Math.random() * 0.1);
            material.opacity = 0.6;
          }
        }
      });
    }
  });

  return (
    <group position={position}>
      <mesh geometry={cylinderGeo} castShadow receiveShadow position={[0, 0.5, 0]} scale={[0.2, 1, 0.2]}>
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <group ref={ref} position={[0, 1, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} geometry={sphereGeo} position={[Math.random()*0.1, i*0.4, Math.random()*0.1]} scale={0.2}>
            <meshStandardMaterial color="#d1d5db" transparent opacity={0.6} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const WINDOW_MAT = new THREE.MeshStandardMaterial({ color: "#bfdbfe", emissive: "#bfdbfe", emissiveIntensity: 0.2, roughness: 0.1, metalness: 0.8 });

const WindowBlock = React.memo(({ position, scale }: { position: [number, number, number], scale: [number, number, number] }) => (
  <PooledMesh geometry={boxGeo} material={WINDOW_MAT} position={position} scale={scale} />
));

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  opacity?: number;
  transparent?: boolean;
  variant?: number;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, variant: propVariant, opacity = 1, transparent = false }: BuildingMeshProps) => {
  const hash = getHash(x, y);
  const variant = propVariant !== undefined ? propVariant : Math.floor(hash * 100); // 0-99
  const rotation = Math.floor(hash * 4) * (Math.PI / 2);
  const { lodLevel } = React.useContext(LODContext);
  
  // Color variation
  const color = useMemo(() => {
    const c = new THREE.Color(baseColor);
    // Shift hue and lightness slightly based on hash
    c.offsetHSL(hash * 0.1 - 0.05, 0, hash * 0.2 - 0.1);
    return c;
  }, [baseColor, hash]);

  const mainMat = useMemo(() => getCachedMaterial(color, 'main', opacity, transparent, { flatShading: true, roughness: 0.8 }), [color, opacity, transparent]);
  const accentMat = useMemo(() => {
    const accentColor = color.clone().multiplyScalar(0.7);
    return getCachedMaterial(accentColor, 'accent', opacity, transparent, { flatShading: true });
  }, [color, opacity, transparent]);
  const roofMat = useMemo(() => {
    const roofColor = color.clone().multiplyScalar(0.5).offsetHSL(0, 0, -0.1);
    return getCachedMaterial(roofColor, 'roof', opacity, transparent, { flatShading: true });
  }, [color, opacity, transparent]);
  const lightMat = useMemo(() => getCachedMaterial('#ffff00', 'light', 1, false, { emissive: new THREE.Color(0xffff00), emissiveIntensity: 0.5 }), []);

  const commonProps = { castShadow: true, receiveShadow: true };

  // Buildings are built assuming y=0 is ground level within their group
  // Adjust vertical position to sit on top of the generated ground tile height
  const yOffset = getTerrainHeight(x + 0.5, y + 0.5) + 0.05;

  // Swap complex model for low-polygon block during low-performance/zoomed-out LOD state
  if (lodLevel === 'low') {
    let blockHeight = 0.6;
    if (type === BuildingType.Commercial) {
      blockHeight = variant < 40 ? 1.5 + hash * 1.5 : 0.8;
    } else if (type === BuildingType.Industrial) {
      blockHeight = 0.8;
    } else if (type === BuildingType.PoliceStation || type === BuildingType.FireStation || type === BuildingType.Hospital) {
      blockHeight = 0.8;
    } else if (type === BuildingType.Park) {
      blockHeight = 0.1;
    }

    return (
      <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
        <PooledMesh 
          geometry={type === BuildingType.Park ? cylinderGeo : boxGeo} 
          material={type === BuildingType.Park ? PARK_GRAVEL_MAT : mainMat} 
          position={[0, blockHeight / 2, 0]} 
          scale={type === BuildingType.Park ? [0.8, blockHeight, 0.8] : [0.7, blockHeight, 0.7]} 
          castShadow 
          receiveShadow 
        />
      </group>
    );
  }

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        switch (type) {
          case BuildingType.Residential:
            if (variant < 33) {
              // Cozy Cottage
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.6]} />
                  <PooledMesh {...commonProps} material={roofMat} geometry={coneGeo} position={[0, 0.75, 0]} scale={[0.6, 0.4, 0.6]} rotation={[0, Math.PI/4, 0]} />
                  <WindowBlock position={[0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                  <WindowBlock position={[-0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.1, 0.32]} scale={[0.15, 0.2, 0.05]} />
                </>
              );
            } else if (variant < 66) {
              // Modern Boxy
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.1, 0.35, 0]} scale={[0.6, 0.7, 0.8]} />
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.25, 0.25, 0.1]} scale={[0.4, 0.5, 0.6]} />
                  <WindowBlock position={[-0.1, 0.5, 0.41]} scale={[0.4, 0.2, 0.05]} />
                </>
              );
            } else {
              // Townhouse with rotating antenna
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[0.5, 1, 0.6]} />
                  <PooledMesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0, 1.05, 0]} scale={[0.55, 0.1, 0.65]} />
                  <WindowBlock position={[0, 0.7, 0.31]} scale={[0.3, 0.2, 0.05]} />
                  <WindowBlock position={[0, 0.3, 0.31]} scale={[0.3, 0.2, 0.05]} />
                  <AnimatedPart geometry={cylinderGeo} material={accentMat} position={[0, 1.2, 0]} scale={[0.05, 0.2, 0.05]} rotationSpeed={0.05} />
                </>
              );
            }

          case BuildingType.Commercial:
            if (variant < 40) {
              // High-rise with blinking lights
              const height = 1.5 + hash * 1.5;
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, height/2, 0]} scale={[0.7, height, 0.7]} />
                  {Array.from({ length: Math.floor(height * 3) }).map((_, i) => (
                    <WindowBlock key={i} position={[0, 0.2 + i * 0.3, 0]} scale={[0.72, 0.15, 0.72]} />
                  ))}
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, height + 0.1, 0]} scale={[0.5, 0.2, 0.5]} />
                  <mesh geometry={sphereGeo} position={[0, height + 0.25, 0]} scale={0.1}>
                    <BlinkingMaterial />
                  </mesh>
                </>
              );
            } else if (variant < 70) {
              // Shop
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <WindowBlock position={[0, 0.3, 0.41]} scale={[0.8, 0.4, 0.05]} />
                  <PooledMesh {...commonProps} material={hash > 0.5 ? accentMat : mainMat} geometry={boxGeo} position={[0, 0.55, 0.5]} scale={[0.9, 0.1, 0.2]} rotation={[Math.PI/6, 0, 0]} />
                </>
              );
            } else {
              // Corner store
               return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.5, -0.2]} scale={[0.5, 1, 0.5]} />
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.1, 0.3, 0.1]} scale={[0.7, 0.6, 0.7]} />
                  <WindowBlock position={[0.1, 0.3, 0.46]} scale={[0.6, 0.3, 0.05]} />
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0.2, 0.65, 0.2]} scale={[0.2, 0.1, 0.2]} />
                </>
               )
            }

          case BuildingType.Industrial:
            if (variant < 50) {
              // Factory
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <PooledMesh {...commonProps} material={roofMat} geometry={boxGeo} position={[-0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <PooledMesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <SmokeStack position={[0.3, 0.4, 0.3]} />
                </>
              );
            } else {
              // Warehouse
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.3, 0]} scale={[0.5, 0.6, 0.9]} />
                  <PooledMesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, -0.2]} scale={[0.2, 0.8, 0.2]} />
                  <PooledMesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, 0.25]} scale={[0.2, 0.8, 0.2]} />
                  <PooledMesh {...commonProps} material={SHELF_GRAY_MAT} geometry={boxGeo} position={[0.25, 0.7, 0]} scale={[0.05, 0.05, 0.5]} />
                </>
              );
            }

          case BuildingType.Park:
            const treeCount = 1 + Math.floor(hash * 3);
            const positions = [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]];
            
            return (
              <group position={[0, -yOffset - 0.29, 0]}>
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <planeGeometry args={[0.9, 0.9]} />
                    <meshStandardMaterial color="#86efac" />
                </mesh>
                
                {variant < 30 && (
                    <group position={[0,0.05,0]}>
                        <PooledMesh material={PARK_GRAVEL_MAT} geometry={cylinderGeo} scale={[0.4, 0.1, 0.4]} castShadow receiveShadow />
                        <PooledMesh material={PARK_POOL_MAT} geometry={cylinderGeo} position={[0, 0.06, 0]} scale={[0.3, 0.05, 0.3]} />
                    </group>
                )}

                {Array.from({length: treeCount}).map((_, i) => {
                    const pos = positions[i % positions.length];
                    const scale = 0.5 + getHash(x+i, y-i) * 0.5;
                    const treeColor = new THREE.Color("#166534").offsetHSL(0, 0, getHash(x,y+i)*0.2);
                    const treeLeafMat = getCachedMaterial(treeColor, 'parkTree', 1, false, { flatShading: true });
                    return (
                    <group key={i} position={[pos[0], 0, pos[1]]} scale={scale} rotation={[0, getHash(i,x)*Math.PI, 0]}>
                        <PooledMesh castShadow receiveShadow material={PARK_TRUNK_MAT} geometry={cylinderGeo} position={[0, 0.15, 0]} scale={[0.1, 0.3, 0.1]} />
                        <PooledMesh castShadow receiveShadow material={treeLeafMat} geometry={coneGeo} position={[0, 0.4, 0]} scale={[0.4, 0.5, 0.4]} />
                        <PooledMesh castShadow receiveShadow material={treeLeafMat} geometry={coneGeo} position={[0, 0.65, 0]} scale={[0.3, 0.4, 0.3]} />
                    </group>
                    )
                })}
              </group>
            );
          case BuildingType.PoliceStation:
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.8, 0.7, 0.8]} />
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.8, 0]} scale={[0.5, 0.2, 0.5]} />
                  <PooledMesh {...commonProps} material={lightMat} geometry={sphereGeo} position={[0, 0.9, 0]} scale={0.1} />
                </>
              );
          case BuildingType.FireStation:
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.35, 0]} scale={[0.8, 0.6, 0.8]} />
                  <PooledMesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0, 0.75, 0]} scale={[0.9, 0.2, 0.9]}/>
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.2, 0.35, 0.2]} scale={[0.3, 0.5, 0.3]} />
                </>
              );
          case BuildingType.Hospital:
              return (
                <>
                  <PooledMesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.8, 0.7, 0.8]} />
                  <PooledMesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0, 0.8, 0]} scale={[0.4, 0.1, 0.4]}/>
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.8, 0]} scale={[0.1, 0.2, 0.4]} />
                  <PooledMesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.8, 0]} scale={[0.4, 0.2, 0.1]} />
                </>
              );
          case BuildingType.Road:
            return null;
          default:
            return null;
        }
      })()}
    </group>
  );
});

// --- 2. Dynamic Systems (Traffic, Citizens, Environment) ---

import { TrafficSystem } from './systems/TrafficSystem';
import { PopulationSystem } from './systems/PopulationSystem';

import { EnvironmentEffects } from './environment/EnvironmentEffects';

const ROAD_LINE_STATIC_GEO = new THREE.PlaneGeometry(0.1, 0.5);
const ROAD_CROSSING_STATIC_GEO = new THREE.PlaneGeometry(0.12, 0.12);

const RoadMarkings = React.memo(({ x, y, grid, yOffset }: { x: number; y: number; grid: Grid; yOffset: number }) => {
  const { lodLevel } = React.useContext(LODContext);
  if (lodLevel === 'low') return null;

  const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
  const hasDown = y < GRID_SIZE - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
  const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
  const hasRight = x < GRID_SIZE - 1 && grid[y][x + 1].buildingType === BuildingType.Road;
  const connections = [hasUp, hasDown, hasLeft, hasRight].filter(Boolean).length;
  if (connections === 0) {
    return (<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]} geometry={ROAD_LINE_STATIC_GEO} material={ROAD_YELLOW_MAT} />);
  }
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
      {(hasUp || hasDown) && (hasLeft || hasRight) && (
        <mesh position={[0, 0, 0.005]} material={ROAD_YELLOW_MAT} geometry={ROAD_CROSSING_STATIC_GEO} />
      )}
      {hasUp && <mesh position={[0, 0.25, 0]} geometry={ROAD_LINE_STATIC_GEO} material={ROAD_YELLOW_MAT} />}
      {hasDown && <mesh position={[0, -0.25, 0]} geometry={ROAD_LINE_STATIC_GEO} material={ROAD_YELLOW_MAT} />}
      {hasLeft && <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={ROAD_LINE_STATIC_GEO} material={ROAD_YELLOW_MAT} />}
      {hasRight && <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={ROAD_LINE_STATIC_GEO} material={ROAD_YELLOW_MAT} />}
    </group>
  );
});

interface GroundTileProps {
    type: BuildingType;
    x: number;
    y: number;
    grid: Grid;
}

const TrafficLightMarker = React.memo(({ x, y, grid }: { x: number; y: number; grid: Grid }) => {
    const { lodLevel } = React.useContext(LODContext);
    if (lodLevel === 'low') return null;

    const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
    const hasDown = y < GRID_SIZE - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
    const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
    const hasRight = x < GRID_SIZE - 1 && grid[y][x + 1].buildingType === BuildingType.Road;
    const connections = [hasUp, hasDown, hasLeft, hasRight].filter(Boolean).length;
    
    if (connections <= 2) return null;
    
    return <TrafficLight hasUp={hasUp} hasDown={hasDown} hasLeft={hasLeft} hasRight={hasRight} />;
});

// --- Config & Themes Shared Statically ---

// --- Bobbing & Scaling Elastic Mesh Placement Animation ---
const AnimatedPlacement = React.memo(({ children, x, y, type }: { children: React.ReactNode, x: number; y: number; type: any }) => {
    const ref = useRef<THREE.Group>(null);
    const progress = useRef(0);
    
    useFrame((state, delta) => {
        if (!ref.current) return;
        if (progress.current < 1) {
            // Delta-independent frame advancement
            progress.current = Math.min(1, progress.current + delta * 2.8);
            
            const t = progress.current;
            // High-fidelity elastic spring
            const elastic = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 2.5);
            
            ref.current.scale.set(elastic, elastic, elastic);
            ref.current.position.y = (1 - t) * -0.4;
        } else {
            ref.current.scale.set(1, 1, 1);
            ref.current.position.y = 0;
        }
    });

    useEffect(() => {
        progress.current = 0;
    }, [type, x, y]);

    return <group ref={ref}>{children}</group>;
});

const TerrainClutter = React.memo(({ x, y, hash }: { x: number; y: number; hash: number }) => {
    const { lodLevel } = React.useContext(LODContext);
    if (lodLevel === 'low') return null;

    // Only add clutter to None tiles
    const isGrass = hash > 0.3;
    if (!isGrass || hash > 0.8) return null;
    
    const type = hash > 0.65 ? 'rock' : 'tree';
    const theme = terrainConfig.theme || 'temperate';
    
    if (theme === 'desert') {
        if (type === 'rock') {
            const scale = 0.05 + hash * 0.06;
            return <mesh geometry={boxGeo} material={CLUTTER_MATERIALS.desertRock} scale={scale} position={[0.2, -0.05, 0.2]} />;
        } else {
            // Saguaro Cactus assembled with branches!
            const mainScale = 0.05 + hash * 0.06;
            return (
                <group position={[-0.1, -0.05, -0.1]}>
                    <mesh geometry={cylinderGeo} material={CLUTTER_MATERIALS.desertCactus} scale={[mainScale * 0.4, mainScale * 4.0, mainScale * 0.4]} position={[0, mainScale * 2.0, 0]} />
                    {hash > 0.45 && <mesh geometry={cylinderGeo} material={CLUTTER_MATERIALS.desertCactus} scale={[mainScale * 0.3, mainScale * 1.5, mainScale * 0.3]} position={[-mainScale * 0.8, mainScale * 2.5, 0]} />}
                    {hash > 0.45 && <mesh geometry={boxGeo} material={CLUTTER_MATERIALS.desertCactus} scale={[mainScale * 1.0, mainScale * 0.3, mainScale * 0.3]} position={[-mainScale * 0.4, mainScale * 1.8, 0]} />}
                </group>
            );
        }
    } else if (theme === 'winter') {
        if (type === 'rock') {
            const scale = 0.05 + hash * 0.05;
            return <mesh geometry={boxGeo} material={CLUTTER_MATERIALS.winterRock} scale={scale} position={[0.2, -0.05, 0.2]} />;
        } else {
            // Snow-dusted pine tree!
            const trunkScale = 0.04 + hash * 0.04;
            const foliageScale = 0.12 + hash * 0.12;
            return (
                <group position={[-0.15, -0.05, -0.15]}>
                    <mesh geometry={cylinderGeo} material={CLUTTER_MATERIALS.winterTrunk} scale={[trunkScale, trunkScale * 4.0, trunkScale]} position={[0, trunkScale * 2.0, 0]} />
                    <mesh geometry={coneGeo} material={CLUTTER_MATERIALS.winterFoliage} scale={[foliageScale, foliageScale * 1.5, foliageScale]} position={[0, trunkScale * 4.0 + foliageScale * 0.5, 0]} />
                    <mesh geometry={coneGeo} material={CLUTTER_MATERIALS.winterSnow} scale={[foliageScale * 0.61, foliageScale * 0.8, foliageScale * 0.61]} position={[0, trunkScale * 4.0 + foliageScale * 1.0, 0]} />
                </group>
            );
        }
    } else {
        // Temperate Theme (Lush foliage & warm stones)
        if (type === 'rock') {
            const scale = 0.05 + hash * 0.05;
            return <mesh geometry={boxGeo} material={CLUTTER_MATERIALS.temperateRock} scale={scale} position={[0.2, -0.05, 0.2]} />;
        } else {
            const trunkScale = 0.04 + hash * 0.04;
            const leavesScale = 0.15 + hash * 0.15;
            return (
                <group position={[-0.15, -0.05, -0.15]}>
                    <mesh geometry={cylinderGeo} material={CLUTTER_MATERIALS.temperateTrunk} scale={[trunkScale, trunkScale * 4.0, trunkScale]} position={[0, trunkScale * 2.1, 0]} />
                    {hash > 0.5 ? (
                      <mesh geometry={sphereGeo} material={CLUTTER_MATERIALS.temperateLeaves} scale={leavesScale} position={[0, trunkScale * 4.0 + leavesScale * 0.4, 0]} />
                    ) : (
                      <mesh geometry={coneGeo} material={CLUTTER_MATERIALS.temperateConifer} scale={[leavesScale, leavesScale * 2.1, leavesScale]} position={[0, trunkScale * 4.0 + leavesScale * 0.85, 0]} />
                    )}
                </group>
            );
        }
    }
});



interface InstancedTerrainProps {
  grid: Grid;
  quality?: number;
}

const InstancedTerrain = React.memo(({ grid, quality = 8 }: InstancedTerrainProps) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const size = grid.length;
    
    const layoutHash = useMemo(() => {
        let hashStr = `${terrainConfig.theme}-${quality}-`;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const tile = grid[y][x];
                if (tile.buildingType === BuildingType.None) hashStr += 'N';
                else if (tile.buildingType === BuildingType.Water) hashStr += 'W';
                else hashStr += 'O';
            }
        }
        return hashStr;
    }, [grid, size, quality]);

    // maxInstances is dynamic based on sub-grid subdivisions
    const maxInstances = size * size * quality * quality;
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    useEffect(() => {
        if (!meshRef.current) return;
        let count = 0;
        const color = new THREE.Color();
        const theme = terrainConfig.theme || 'temperate';
        const colorArray = new Float32Array(maxInstances * 3);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const tile = grid[y][x];
                // Skip if there's a building, but ALLOW Water building type so riverbed renders
                if (tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Water) continue;
                
                const [wx, _, wz] = gridToWorld(x, y);
                
                for (let sx = 0; sx < quality; sx++) {
                    for (let sy = 0; sy < quality; sy++) {
                        const preciseX = x + sx / quality;
                        const preciseY = y + sy / quality;
                        
                        let subTopY = getTerrainHeight(preciseX, preciseY, grid);
                        
                        // Overwrite with flattened height if the tile contains a building
                        if (tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Water) {
                             subTopY = getTerrainHeight(x + 0.5, y + 0.5, grid);
                        }
                        
                        let baseLevel = -1.5;
                        let subThickness = subTopY - baseLevel; 
                        
                        let subColorStr = '#22c55e';
                        // Noise value to break up coloring
                        const detailNoise = smoothNoise(preciseX * 2.5, preciseY * 2.5);
                        const medNoise = smoothNoise(preciseX * 0.8, preciseY * 0.8);
                        
                        if (theme === 'desert') {
                            if (subTopY < -0.28) {
                                subColorStr = detailNoise > 0.5 ? '#fef08a' : '#fde047';
                            } else if (subTopY < 0.2) {
                                subColorStr = medNoise > 0.5 ? '#d97706' : '#f59e0b';
                            } else if (subTopY < 0.5) {
                                subColorStr = detailNoise > 0.5 ? '#b45309' : '#92400e';
                            } else {
                                subColorStr = '#78350f';
                            }
                        } else if (theme === 'winter') {
                            if (subTopY < -0.28) {
                                subColorStr = detailNoise > 0.5 ? '#cbd5e1' : '#e2e8f0';
                            } else if (subTopY < 0.2) {
                                subColorStr = medNoise > 0.5 ? '#f1f5f9' : '#f8fafc';
                            } else if (subTopY < 0.45) {
                                subColorStr = detailNoise > 0.5 ? '#94a3b8' : '#cbd5e1';
                            } else {
                                subColorStr = '#ffffff';
                            }
                        } else {
                            if (subTopY < -0.28) {
                                subColorStr = detailNoise > 0.5 ? '#fde047' : '#fef08a';
                            } else if (subTopY < 0.21) {
                                const gV = medNoise + detailNoise * 0.5;
                                subColorStr = gV > 0.6 ? '#15803d' : gV > 0.4 ? '#16a34a' : '#22c55e';
                            } else if (subTopY < 0.5) {
                                subColorStr = detailNoise > 0.5 ? '#78716c' : '#a8a29e';
                            } else {
                                subColorStr = '#f8fafc';
                            }
                        }
                        
                        const w = 1 / quality;
                        const offX = (sx + 0.5) * w - 0.5;
                        const offZ = (sy + 0.5) * w - 0.5;
                        
                        dummy.position.set(wx + offX, baseLevel + subThickness/2, wz + offZ);
                        dummy.scale.set(w, subThickness, w);
                        dummy.updateMatrix();
                        
                        meshRef.current.setMatrixAt(count, dummy.matrix);
                        color.set(subColorStr);
                        colorArray[count*3] = color.r;
                        colorArray[count*3+1] = color.g;
                        colorArray[count*3+2] = color.b;
                        
                        count++;
                    }
                }
            }
        }
        meshRef.current.count = count;
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colorArray.slice(0, count * 3), 3);
        meshRef.current.instanceColor.needsUpdate = true;
    }, [layoutHash, dummy, size, quality, maxInstances]);

    return (
        <instancedMesh ref={meshRef} args={[boxGeo, undefined, maxInstances]} receiveShadow>
            <meshStandardMaterial flatShading roughness={1} />
        </instancedMesh>
    );
});

const MapInteractionPlane = ({ size, onHover, onLeave, onClick }: { 
    size: number;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
}) => {
    const theme = terrainConfig.theme || 'temperate';
    const pointerStart = useRef({ x: 0, y: 0 });
    let waterColor = '#0ea5e9';
    let roughness = 0.15;
    
    if (theme === 'winter') {
        waterColor = '#a5f3fc'; // Frozen bright sky blue ice lake
        roughness = 0.02;
    } else if (theme === 'desert') {
        waterColor = '#0ea5e9';
    }

    const handlePointerMove = (e: any) => {
        e.stopPropagation();
        if (!e.point) return;
        const wx = e.point.x;
        const wz = e.point.z;
        const x = Math.round(wx + WORLD_OFFSET);
        const y = Math.round(wz + WORLD_OFFSET);
        
        if (x >= 0 && x < size && y >= 0 && y < size) {
            onHover(x, y);
        } else {
            onLeave();
        }
    };

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        pointerStart.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: any) => {
        e.stopPropagation();
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 8 && e.point) {
            const wx = e.point.x;
            const wz = e.point.z;
            const x = Math.round(wx + WORLD_OFFSET);
            const y = Math.round(wz + WORLD_OFFSET);
            
            if (x >= 0 && x < size && y >= 0 && y < size) {
                onClick(x, y);
            }
        }
    };

    return (
        <group>
            {/* Global Water Plane */}
            <mesh position={[0, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[150, 150]} />
                <meshStandardMaterial color={waterColor} transparent opacity={theme === 'winter' ? 0.85 : 0.7} roughness={roughness} />
            </mesh>

            {/* Flat high-performance collision interaction plane on Y=0 */}
            <mesh 
                position={[0, 0, 0]} 
                rotation={[-Math.PI / 2, 0, 0]} 
                onPointerMove={handlePointerMove}
                onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
            >
                <planeGeometry args={[size, size]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            </mesh>
        </group>
    );
};

const DevFrameStatsCollector = ({ onStats, onLodChange }: { onStats: (fps: number, drawCalls: number, triangles: number) => void, onLodChange?: (level: 'high' | 'low') => void }) => {
    const lastTime = useRef(performance.now());
    const frames = useRef(0);
    const lastEmit = useRef(performance.now());

    useFrame((state) => {
        frames.current++;
        const now = performance.now();
        
        // Push stats every 500ms
        if (now - lastEmit.current >= 500) {
            const delta = now - lastTime.current;
            const fps = Math.round((frames.current * 1000) / delta);
            frames.current = 0;
            lastTime.current = now;
            lastEmit.current = now;
            
            const glInfo = state.gl.info;
            onStats(fps, glInfo.render.calls, glInfo.render.triangles);

            if (onLodChange) {
                const zoom = state.camera.zoom;
                // Avoid using dynamic FPS to prevent infinite loops of quality changes or flickering.
                // Switch LOD solely on zoom factor for consistent visual predictability.
                const level = (zoom < 30) ? 'low' : 'high';
                onLodChange(level);
            }
        }
    });

    return null;
};

const GroundTile = React.memo(({ type, x, y, grid }: GroundTileProps) => {
  const { lodLevel } = React.useContext(LODContext);
  const [wx, _, wz] = gridToWorld(x, y);
  
  // Advanced Terrain Generation using noise
  const hash = getHash(x, y); // Provides base 0-1
  
  const isWater = grid[y][x].isWater;
  const isBridge = type === BuildingType.Road && isWater;
  const tileHeight = getTerrainHeight(x + 0.5, y + 0.5, grid);

  let color = '#10b981';
  let topY = tileHeight; 
  let thickness = 0.5;

  // Constant base levels
  const baseLevel = -1.5;
  
  if (type === BuildingType.None || type === BuildingType.Water) {
      if (isWater) { // Water/River
         return null; // Handled by global water plain
      } else {
          return (
             <group position={[wx, tileHeight, wz]} raycast={() => null}>
                 <TerrainClutter x={x} y={y} hash={hash} />
             </group>
          );
      }
  } else if (type === BuildingType.Road) {
    color = '#374151';
    topY = isBridge ? -0.15 : tileHeight + 0.01; 
    thickness = isBridge ? 0.05 : 0.5;
  } else {
    color = '#d1d5db'; // concrete base
    topY = tileHeight + 0.02;
  }

  // Extend tiles down to baseLevel -1.5 for a clean slice, unless it's a bridge
  const actualThickness = isBridge ? thickness : topY - baseLevel;
  const centerY = isBridge ? (topY - thickness/2) : (baseLevel + actualThickness/2);

  return (
    <group raycast={() => null}>
      <mesh position={[wx, centerY, wz]} geometry={boxGeo} scale={[1, actualThickness, 1]} receiveShadow castShadow>
          <meshStandardMaterial color={color} flatShading roughness={1} />
          {type === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={actualThickness / 2 + 0.001} />}
          {type === BuildingType.Road && <TrafficLightMarker x={x} y={y} grid={grid} />}
      </mesh>

      {/* Bridges Visual enhancement: heavy slate blue columns and modern mesh side rails */}
      {isBridge && lodLevel === 'high' && (
        <group>
          {/* Deck frame side structure */}
          <mesh position={[wx, centerY - 0.04, wz]} geometry={boxGeo} scale={[1.05, 0.04, 1.05]} castShadow receiveShadow>
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Guard Rail Left */}
          <mesh position={[wx, centerY + 0.1, wz - 0.46]} geometry={boxGeo} scale={[1.0, 0.16, 0.04]} castShadow receiveShadow>
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.2} />
          </mesh>
          {/* Guard Rail Right */}
          <mesh position={[wx, centerY + 0.1, wz + 0.46]} geometry={boxGeo} scale={[1.0, 0.16, 0.04]} castShadow receiveShadow>
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.2} />
          </mesh>
          {/* Dynamic pillar supports reaching deep into the channel base */}
          <mesh position={[wx, (centerY - actualThickness/2 + baseLevel) / 2, wz]} geometry={boxGeo} scale={[0.26, centerY - actualThickness/2 - baseLevel, 0.48]} castShadow receiveShadow>
            <meshStandardMaterial color="#334155" roughness={0.9} flatShading />
          </mesh>
          {/* Concrete collar footing at water level */}
          <mesh position={[wx, baseLevel + 0.2, wz]} geometry={boxGeo} scale={[0.42, 0.3, 0.64]} castShadow receiveShadow>
            <meshStandardMaterial color="#475569" roughness={0.95} />
          </mesh>
        </group>
      )}
    </group>
  );
});

const Cursor = React.forwardRef<THREE.Mesh, { grid: Grid }>((props, ref) => {
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="white" transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
      <Outlines thickness={0.05} color="white" />
    </mesh>
  );
});
Cursor.displayName = 'Cursor';

const InstancedStaticStructures = React.memo(({ grid }: { grid: Grid }) => {
    const roadBaseRef = useRef<THREE.InstancedMesh>(null);
    const resBaseRef = useRef<THREE.InstancedMesh>(null);
    const resBuildingRef = useRef<THREE.InstancedMesh>(null);

    const size = grid.length;
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!roadBaseRef.current || !resBaseRef.current || !resBuildingRef.current) return;
        
        let roadCount = 0;
        let resCount = 0;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const tile = grid[y][x];
                const type = tile.buildingType;
                if (type !== BuildingType.Road && type !== BuildingType.Residential) continue;
                
                const [wx, _, wz] = gridToWorld(x, y);
                const tileHeight = getTerrainHeight(x + 0.5, y + 0.5, grid);
                const isWater = tile.isWater;
                const baseLevel = -1.5;
                
                if (type === BuildingType.Road) {
                    const isBridge = isWater;
                    const topY = isBridge ? -0.15 : tileHeight + 0.01; 
                    const thickness = isBridge ? 0.05 : 0.5;
                    const actualThickness = isBridge ? thickness : topY - baseLevel;
                    const centerY = isBridge ? (topY - thickness/2) : (baseLevel + actualThickness/2);
                    
                    dummy.position.set(wx, centerY, wz);
                    dummy.scale.set(1, actualThickness, 1);
                    dummy.updateMatrix();
                    
                    roadBaseRef.current.setMatrixAt(roadCount, dummy.matrix);
                    roadCount++;
                } else if (type === BuildingType.Residential) {
                    // Concrete base
                    const topY = tileHeight + 0.02;
                    const actualThickness = topY - baseLevel;
                    const centerY = baseLevel + actualThickness/2;
                    
                    dummy.position.set(wx, centerY, wz);
                    dummy.scale.set(1, actualThickness, 1);
                    dummy.updateMatrix();
                    resBaseRef.current.setMatrixAt(resCount, dummy.matrix);
                    
                    // Simple block building (replacing procedural for performance)
                    const hash = getHash(x, y);
                    let blockHeight = 0.6;
                    const yOffset = getTerrainHeight(x + 0.5, y + 0.5) + 0.05;
                    
                    // Add some variance in residential rotation
                    const rotation = Math.floor(hash * 4) * (Math.PI / 2);
                    dummy.rotation.set(0, rotation, 0);
                    dummy.position.set(wx, yOffset + blockHeight/2, wz);
                    dummy.scale.set(0.7, blockHeight, 0.7);
                    
                    // Base color logic
                    const c = new THREE.Color(BUILDINGS[BuildingType.Residential].color);
                    c.offsetHSL(hash * 0.1 - 0.05, 0, hash * 0.2 - 0.1);
                    
                    dummy.updateMatrix();
                    resBuildingRef.current.setMatrixAt(resCount, dummy.matrix);
                    resBuildingRef.current.setColorAt(resCount, c);
                    // Reset rotation for base
                    dummy.rotation.set(0, 0, 0);
                    
                    resCount++;
                }
            }
        }
        
        roadBaseRef.current.count = roadCount;
        roadBaseRef.current.instanceMatrix.needsUpdate = true;
        
        resBaseRef.current.count = resCount;
        resBaseRef.current.instanceMatrix.needsUpdate = true;
        
        resBuildingRef.current.count = resCount;
        resBuildingRef.current.instanceMatrix.needsUpdate = true;
        if (resBuildingRef.current.instanceColor) resBuildingRef.current.instanceColor.needsUpdate = true;
        
    }, [grid, size, dummy]);

    const maxCount = size * size;

    return (
        <group raycast={() => null}>
            <instancedMesh ref={roadBaseRef} args={[boxGeo, undefined, maxCount]} receiveShadow castShadow>
                <meshStandardMaterial color="#374151" flatShading roughness={1} />
            </instancedMesh>
            <instancedMesh ref={resBaseRef} args={[boxGeo, undefined, maxCount]} receiveShadow castShadow>
                <meshStandardMaterial color="#d1d5db" flatShading roughness={1} />
            </instancedMesh>
            <instancedMesh ref={resBuildingRef} args={[boxGeo, undefined, maxCount]} receiveShadow castShadow>
                <meshStandardMaterial flatShading roughness={0.8} />
            </instancedMesh>
        </group>
    );
});

interface GridTileRendererProps {
  tile: TileData;
  x: number;
  y: number;
  grid: Grid;
  tileGroupsRef: React.MutableRefObject<Record<string, THREE.Group | null>>;
}

const GridTileRenderer: React.FC<GridTileRendererProps> = React.memo(({
  tile,
  x,
  y,
  grid,
  tileGroupsRef
}) => {
  // Drastically cut down render overhead by completely ignoring static instanced meshes here
  if (tile.buildingType === BuildingType.Road || tile.buildingType === BuildingType.Residential) {
      return null;
  }

  const [wx, _, wz] = gridToWorld(x, y);
  const groupRef = useRef<THREE.Group>(null);

  // Register group for direct high-performance frustum culling inside useFrame
  useEffect(() => {
    tileGroupsRef.current[`${x}-${y}`] = groupRef.current;
    return () => {
      delete tileGroupsRef.current[`${x}-${y}`];
    };
  }, [x, y, tileGroupsRef]);

  return (
    <group ref={groupRef}>
      <GroundTile 
        type={tile.buildingType} 
        x={x} 
        y={y} 
        grid={grid}
      />
      
      {/* Building visual - apply world position and rotation to group to align with ground tile */}
      <group position={[wx, 0, wz]} rotation={[0, ((tile.rotation || 0) * Math.PI) / 180, 0]} raycast={() => null}>
        {tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
          <AnimatedPlacement x={x} y={y} type={tile.buildingType}>
            <ProceduralBuilding 
              type={tile.buildingType} 
              baseColor={BUILDINGS[tile.buildingType].color} 
              x={x} 
              y={y} 
              variant={tile.variant}
            />
          </AnimatedPlacement>
        )}
      </group>
    </group>
  );
}, (prev, next) => {
  // Memoization: only re-render if the core visual properties of the tile change
  return prev.tile.buildingType === next.tile.buildingType &&
         prev.tile.rotation === next.tile.rotation &&
         prev.tile.variant === next.tile.variant &&
         prev.tile.isWater === next.tile.isWater &&
         prev.x === next.x &&
         prev.y === next.y;
});
GridTileRenderer.displayName = 'GridTileRenderer';

interface GameLoopManagerProps {
  grid: Grid;
  hoveredTool: BuildingType;
  hoveredTileRef: React.MutableRefObject<{x: number, y: number} | null>;
  cursorRef: React.RefObject<THREE.Mesh | null>;
  previewGroupRef: React.RefObject<THREE.Group | null>;
  tileGroupsRef: React.MutableRefObject<Record<string, THREE.Group | null>>;
}

const GameLoopManager: React.FC<GameLoopManagerProps> = ({
  grid,
  hoveredTool,
  hoveredTileRef,
  cursorRef,
  previewGroupRef,
  tileGroupsRef
}) => {
  useFrame((state) => {
    const hTile = hoveredTileRef.current;
    const isBulldoze = hoveredTool === BuildingType.None;
    const showPreview = hTile && grid[hTile.y]?.[hTile.x]?.buildingType === BuildingType.None && hoveredTool !== BuildingType.None;

    // --- 1. High-Performance Grid Frustum Culling ---
    let cx = 0;
    let cz = 0;
    if (state.controls && (state.controls as any).target) {
      cx = (state.controls as any).target.x;
      cz = (state.controls as any).target.z;
    } else {
      cx = state.camera.position.x - 20;
      cz = state.camera.position.z - 20;
    }

    const zoom = state.camera.zoom;
    // Compute visible radius based on current camera zoom factor
    const visibleRadius = Math.max(12, 1100 / zoom);
    
    const size = grid.length;
    for (const key in tileGroupsRef.current) {
        const group = tileGroupsRef.current[key];
        if (!group) continue;
        const [xStr, yStr] = key.split('-');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        const [wx, _, wz] = gridToWorld(x, y);
        const dx = wx - cx;
        const dz = wz - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        group.visible = dist < visibleRadius;
    }

    // --- 2. High-Performance Cursor Positioning ---
    if (cursorRef.current) {
      if (hTile) {
        const [wx, _, wz] = gridToWorld(hTile.x, hTile.y);
        const tileHeight = getTerrainHeight(hTile.x + 0.5, hTile.y + 0.5, grid);
        cursorRef.current.position.set(wx, tileHeight + 0.05, wz);
        cursorRef.current.visible = true;

        const targetColor = isBulldoze ? '#ef4444' : (showPreview ? '#ffffff' : '#000000');
        const mat = cursorRef.current.material as THREE.MeshBasicMaterial;
        if (mat && mat.color) {
          mat.color.set(targetColor);
        }
      } else {
        cursorRef.current.visible = false;
      }
    }

    // --- 3. High-Performance Preview Positioning ---
    if (previewGroupRef.current) {
      if (showPreview && hTile) {
        const [wx, _, wz] = gridToWorld(hTile.x, hTile.y);
        previewGroupRef.current.position.set(wx, 0, wz);
        previewGroupRef.current.visible = true;
      } else {
        previewGroupRef.current.visible = false;
      }
    }
  });

  return null;
};

interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  population: number;
  day: number;
  showDevStats?: boolean;
  themeName?: 'temperate' | 'desert' | 'winter';
  ruggedness?: number;
  seed?: number;
  terrainQuality?: number;
  enableShadows?: boolean;
  onDevFrameStats?: (fps: number, drawCalls: number, triangles: number) => void;
}

const IsoMap: React.FC<IsoMapProps> = ({ 
  grid, 
  onTileClick, 
  hoveredTool, 
  population, 
  day, 
  showDevStats,
  themeName = 'temperate',
  ruggedness = 1.3,
  seed = 0,
  terrainQuality = 8,
  enableShadows = true,
  onDevFrameStats,
}) => {
  // Multi-LOD Management State
  const [lodLevel, setLodLevel] = useState<'high' | 'low'>('high');

  const handleLodChange = useCallback((level: 'high' | 'low') => {
    setLodLevel((prev) => (prev !== level ? level : prev));
  }, []);

  // Sync static configurations
  terrainConfig.theme = themeName;
  terrainConfig.ruggedness = ruggedness;
  terrainConfig.seed = seed;

  // Game loop coordinate tracking via standard mutable references.
  // This bypasses the heavy React re-renders triggered on mouse/finger move!
  const hoveredTileRef = useRef<{x: number, y: number} | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    hoveredTileRef.current = { x, y };
  }, []);

  const handleLeave = useCallback(() => {
    hoveredTileRef.current = null;
  }, []);

  // Refs for requestAnimationFrame update loop to animate/position elements outside React
  const cursorRef = useRef<THREE.Mesh>(null);
  const previewGroupRef = useRef<THREE.Group>(null);
  const tileGroupsRef = useRef<Record<string, THREE.Group | null>>({});

  return (
    <div className="absolute inset-0 bg-sky-900 touch-none">
      <LODContext.Provider value={{ lodLevel }}>
        <Canvas shadows={enableShadows} dpr={[1, 1.2]} gl={{ antialias: true, failIfMajorPerformanceCaveat: false }}>
          {showDevStats && <Stats showPanel={0} />}
          {onDevFrameStats && (
            <DevFrameStatsCollector 
              onStats={onDevFrameStats} 
              onLodChange={handleLodChange} 
            />
          )}
          <OrthographicCamera makeDefault zoom={55} position={[20, 20, 20]} near={-100} far={200} />
          
          <MapControls 
            enableRotate={true}
            enableZoom={true}
            minZoom={20}
            maxZoom={120}
            maxPolarAngle={Math.PI / 2.2}
            minPolarAngle={0.1}
            target={[0,-0.5,0]}
          />

          <ambientLight intensity={day % 24 < 6 || day % 24 > 18 ? 0.2 : 0.8} color={themeName === 'winter' ? '#e2e8f0' : '#cceeff'} />
          <directionalLight
            castShadow={enableShadows}
            position={[15, 20, 10]}
            intensity={day % 24 < 6 || day % 24 > 18 ? 0.3 : 1.8}
            color={themeName === 'winter' ? '#f1f5f9' : '#fffbeb'}
            shadow-mapSize={enableShadows ? [1024, 1024] : [256, 256]}
            shadow-camera-left={-15} shadow-camera-right={15}
            shadow-camera-top={15} shadow-camera-bottom={-15}
          />
          <Environment preset="city" />

          <EnvironmentEffects day={day} />

          <InstancedTerrain grid={grid} quality={terrainQuality} />
          <InstancedStaticStructures grid={grid} />
          <MapInteractionPlane 
            size={grid.length} 
            onHover={handleHover} 
            onLeave={handleLeave} 
            onClick={onTileClick} 
          />

          {/* High-Performance Frame loop Manager (The Game Loop) */}
          <GameLoopManager 
            grid={grid} 
            hoveredTool={hoveredTool} 
            hoveredTileRef={hoveredTileRef}
            cursorRef={cursorRef}
            previewGroupRef={previewGroupRef}
            tileGroupsRef={tileGroupsRef}
          />

          <group>
            {grid.map((row, y) =>
              row.map((tile, x) => (
                <GridTileRenderer 
                  key={`${x}-${y}`}
                  tile={tile}
                  x={x}
                  y={y}
                  grid={grid}
                  tileGroupsRef={tileGroupsRef}
                />
              ))
            )}

            {/* Visual Elements - disable pointer events */}
            <group raycast={() => null}>
              <TrafficSystem grid={grid} />
              <PopulationSystem population={population} grid={grid} />

              {/* Placement Preview */}
              <group ref={previewGroupRef} visible={false}>
                <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                  {hoveredTool !== BuildingType.None && (
                    <ProceduralBuilding 
                      type={hoveredTool} 
                      baseColor={BUILDINGS[hoveredTool]?.color || 'white'} 
                      x={0} 
                      y={0} 
                      transparent 
                      opacity={0.7} 
                    />
                  )}
                </Float>
              </group>

              {/* Highlight */}
              <Cursor ref={cursorRef} grid={grid} />
            </group>
          </group>
          
          {enableShadows && <SoftShadows size={10} samples={8} />}
        </Canvas>
      </LODContext.Provider>
    </div>
  );
};

export default IsoMap;