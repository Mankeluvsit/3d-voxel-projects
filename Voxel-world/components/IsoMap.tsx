/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { MapControls, Environment, SoftShadows, Instance, Instances, Float, useTexture, Outlines, OrthographicCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { Grid, BuildingType, TileData, PerformanceStats, LODLevel } from '../types';
import { BUILDINGS } from '../constants';
import { analyzePerformance } from '../services/aiService';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

// --- Constants & Helpers ---
const getGridToWorld = (gridSize: number) => {
  const offset = gridSize / 2 - 0.5;
  return (x: number, y: number) => [x - offset, 0, y - offset] as [number, number, number];
};

// Deterministic random based on coordinates
const getHash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
const getRandomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Shared Geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);

// --- 1. Advanced Procedural Buildings ---

// FIX: Wrap component in React.memo to ensure TypeScript recognizes it as a component that accepts a 'key' prop.
const WindowBlock = React.memo(({ position, scale }: { position: [number, number, number], scale: [number, number, number] }) => (
  <mesh geometry={boxGeo} position={position} scale={scale}>
    <meshStandardMaterial color="#bfdbfe" emissive="#bfdbfe" emissiveIntensity={0.2} roughness={0.1} metalness={0.8} />
  </mesh>
));

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

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  opacity?: number;
  transparent?: boolean;
  lodLevel?: LODLevel;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, opacity = 1, transparent = false, lodLevel = 'High' }: BuildingMeshProps) => {
  const hash = getHash(x, y);
  const variant = Math.floor(hash * 100); // 0-99
  const rotation = Math.floor(hash * 4) * (Math.PI / 2);
  
  // Color variation
  const color = useMemo(() => {
    const c = new THREE.Color(baseColor);
    // Shift hue and lightness slightly based on hash
    c.offsetHSL(hash * 0.1 - 0.05, 0, hash * 0.2 - 0.1);
    return c;
  }, [baseColor, hash]);

  const mainMat = useMemo(() => new THREE.MeshStandardMaterial({ color, flatShading: true, opacity, transparent, roughness: 0.8 }), [color, opacity, transparent]);
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), flatShading: true, opacity, transparent }), [color, opacity, transparent]);
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.5).offsetHSL(0,0,-0.1), flatShading: true, opacity, transparent }), [color, opacity, transparent]);

  const commonProps = { castShadow: true, receiveShadow: true };

  // Buildings are built assuming y=0 is ground level within their group
  // Adjust vertical position to sit on top of ground tile (approx -0.3)
  const yOffset = -0.3;

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        switch (type) {
          case BuildingType.Residential:
            if (lodLevel === 'Low') {
              return <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.6]} />;
            }
            if (variant < 33) {
              // Cozy Cottage
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={coneGeo} position={[0, 0.75, 0]} scale={[0.6, 0.4, 0.6]} rotation={[0, Math.PI/4, 0]} />
                  {lodLevel === 'High' && (
                    <>
                      <WindowBlock position={[0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                      <WindowBlock position={[-0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                      <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.1, 0.32]} scale={[0.15, 0.2, 0.05]} />
                    </>
                  )}
                </>
              );
            } else if (variant < 66) {
              // Modern Boxy
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.1, 0.35, 0]} scale={[0.6, 0.7, 0.8]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.25, 0.25, 0.1]} scale={[0.4, 0.5, 0.6]} />
                  {lodLevel === 'High' && <WindowBlock position={[-0.1, 0.5, 0.41]} scale={[0.4, 0.2, 0.05]} />}
                </>
              );
            } else {
              // Townhouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[0.5, 1, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0, 1.05, 0]} scale={[0.55, 0.1, 0.65]} />
                  {lodLevel === 'High' && (
                    <>
                      <WindowBlock position={[0, 0.7, 0.31]} scale={[0.3, 0.2, 0.05]} />
                      <WindowBlock position={[0, 0.3, 0.31]} scale={[0.3, 0.2, 0.05]} />
                    </>
                  )}
                </>
              );
            }

          case BuildingType.Commercial:
            if (lodLevel === 'Low') {
              const height = 1.5 + hash * 1.5;
              return <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, height/2, 0]} scale={[0.7, height, 0.7]} />;
            }
            if (variant < 40) {
              // High-rise
              const height = 1.5 + hash * 1.5;
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, height/2, 0]} scale={[0.7, height, 0.7]} />
                  {lodLevel === 'High' && Array.from({ length: Math.floor(height * 3) }).map((_, i) => (
                    <WindowBlock key={i} position={[0, 0.2 + i * 0.3, 0]} scale={[0.72, 0.15, 0.72]} />
                  ))}
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, height + 0.1, 0]} scale={[0.5, 0.2, 0.5]} />
                </>
              );
            } else if (variant < 70) {
              // Shop
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  {lodLevel === 'High' && <WindowBlock position={[0, 0.3, 0.41]} scale={[0.8, 0.4, 0.05]} />}
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({ color: hash > 0.5 ? '#ef4444' : '#3b82f6' })} geometry={boxGeo} position={[0, 0.55, 0.5]} scale={[0.9, 0.1, 0.2]} rotation={[Math.PI/6, 0, 0]} />
                </>
              );
            } else {
              // Corner store
               return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.5, -0.2]} scale={[0.5, 1, 0.5]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.1, 0.3, 0.1]} scale={[0.7, 0.6, 0.7]} />
                  {lodLevel === 'High' && <WindowBlock position={[0.1, 0.3, 0.46]} scale={[0.6, 0.3, 0.05]} />}
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#9ca3af'})} geometry={boxGeo} position={[0.2, 0.65, 0.2]} scale={[0.2, 0.1, 0.2]} />
                </>
               )
            }

          case BuildingType.Industrial:
            if (lodLevel === 'Low') {
              return <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />;
            }
            if (variant < 50) {
              // Factory
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[-0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <SmokeStack position={[0.3, 0.4, 0.3]} />
                </>
              );
            } else {
              // Warehouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.3, 0]} scale={[0.5, 0.6, 0.9]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, -0.2]} scale={[0.2, 0.8, 0.2]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, 0.25]} scale={[0.2, 0.8, 0.2]} />
                  {lodLevel === 'High' && <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#6b7280'})} geometry={boxGeo} position={[0.25, 0.7, 0]} scale={[0.05, 0.05, 0.5]} />}
                </>
              );
            }

          case BuildingType.Park:
            const treeCount = 1 + Math.floor(hash * 3);
            const positions = [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]];
            
            return (
              <group position={[0, -yOffset - 0.29, 0]}> {/* Adjust park base to sit exactly on top of ground tile */}
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <planeGeometry args={[0.9, 0.9]} />
                    <meshStandardMaterial color="#86efac" />
                </mesh>
                
                {variant < 30 && (
                    <group position={[0,0.05,0]}>
                        <mesh material={new THREE.MeshStandardMaterial({color: '#cbd5e1'})} geometry={cylinderGeo} scale={[0.4, 0.1, 0.4]} castShadow receiveShadow />
                        <mesh material={new THREE.MeshStandardMaterial({color: '#3b82f6', roughness: 0.1})} geometry={cylinderGeo} position={[0, 0.06, 0]} scale={[0.3, 0.05, 0.3]} />
                    </group>
                )}

                {Array.from({length: treeCount}).map((_, i) => {
                    const pos = positions[i % positions.length];
                    const scale = 0.5 + getHash(x+i, y-i) * 0.5;
                    const treeColor = new THREE.Color("#166534").offsetHSL(0, 0, getHash(x,y+i)*0.2);
                    return (
                    <group key={i} position={[pos[0], 0, pos[1]]} scale={scale} rotation={[0, getHash(i,x)*Math.PI, 0]}>
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: '#78350f' })} geometry={cylinderGeo} position={[0, 0.15, 0]} scale={[0.1, 0.3, 0.1]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.4, 0]} scale={[0.4, 0.5, 0.4]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.65, 0]} scale={[0.3, 0.4, 0.3]} />
                    </group>
                    )
                })}
              </group>
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

const carColors = ['#ef4444', '#3b82f6', '#eab308', '#ffffff', '#1f2937', '#f97316'];

const TrafficSystem = ({ grid, gridSize }: { grid: Grid, gridSize: number }) => {
  const gridToWorld = useMemo(() => getGridToWorld(gridSize), [gridSize]);
  const roadTiles = useMemo(() => {
    const roads: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      if (tile.buildingType === BuildingType.Road) roads.push({x: tile.x, y: tile.y});
    }));
    return roads;
  }, [grid]);

  const carCount = Math.min(roadTiles.length, 30);
  const carsRef = useRef<THREE.InstancedMesh>(null);
  const carsState = useRef<Float32Array>(new Float32Array(0)); 
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => new Float32Array(0), []);

  useEffect(() => {
    if (roadTiles.length < 2) return;
    carsState.current = new Float32Array(carCount * 6);
    const newColors = new Float32Array(carCount * 3);

    for (let i = 0; i < carCount; i++) {
      const startNode = roadTiles[Math.floor(Math.random() * roadTiles.length)];
      carsState.current[i*6 + 0] = startNode.x;
      carsState.current[i*6 + 1] = startNode.y;
      carsState.current[i*6 + 2] = startNode.x;
      carsState.current[i*6 + 3] = startNode.y;
      carsState.current[i*6 + 4] = 1; // force pick new target
      carsState.current[i*6 + 5] = getRandomRange(0.01, 0.03); // speed

      const color = new THREE.Color(carColors[Math.floor(Math.random() * carColors.length)]);
      newColors[i*3] = color.r; newColors[i*3+1] = color.g; newColors[i*3+2] = color.b;
    }

    if (carsRef.current) {
        carsRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
    }
  }, [roadTiles, carCount]);

  useFrame(() => {
    if (!carsRef.current || roadTiles.length < 2 || carsState.current.length === 0) return;

    for (let i = 0; i < carCount; i++) {
      const idx = i * 6;
      let curX = carsState.current[idx];
      let curY = carsState.current[idx+1];
      let tarX = carsState.current[idx+2];
      let tarY = carsState.current[idx+3];
      let progress = carsState.current[idx+4];
      const speed = carsState.current[idx+5];

      progress += speed;

      if (progress >= 1) {
        curX = tarX;
        curY = tarY;
        progress = 0;
        
        const neighbors = roadTiles.filter(t => 
          (Math.abs(t.x - curX) === 1 && t.y === curY) || 
          (Math.abs(t.y - curY) === 1 && t.x === curX)
        );

        if (neighbors.length > 0) {
            // Simple pathfinding: avoid going back immediately
            const valid = neighbors.length > 1 
                ? neighbors.filter(n => Math.abs(n.x - carsState.current[idx]) > 0.1 || Math.abs(n.y - carsState.current[idx+1]) > 0.1)
                : neighbors;
            
            const next = valid.length > 0 
                ? valid[Math.floor(Math.random() * valid.length)]
                : neighbors[0];
            
            tarX = next.x;
            tarY = next.y;
        } else {
            const rnd = roadTiles[Math.floor(Math.random() * roadTiles.length)];
            curX = rnd.x; curY = rnd.y; tarX = rnd.x; tarY = rnd.y;
        }
      }

      carsState.current[idx] = curX;
      carsState.current[idx+1] = curY;
      carsState.current[idx+2] = tarX;
      carsState.current[idx+3] = tarY;
      carsState.current[idx+4] = progress;

      // Interpolate position
      const gx = MathUtils.lerp(curX, tarX, progress);
      const gy = MathUtils.lerp(curY, tarY, progress);

      // Determine driving side offset
      const dx = tarX - curX;
      const dy = tarY - curY;
      const angle = Math.atan2(dy, dx);
      
      // Offset to right side relative to movement
      const offsetAmt = 0.15;
      // Normals: (-dy, dx)
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const offX = (-dy/len) * offsetAmt;
      const offY = (dx/len) * offsetAmt;

      const [wx, _, wz] = gridToWorld(gx + offX, gy + offY);

      // Road surface is approx -0.3. Car height 0.15.
      dummy.position.set(wx, -0.3 + 0.075, wz);
      dummy.rotation.set(0, -angle, 0);
      // Car dimensions (Length(X), Height(Y), Width(Z) assuming 0 rotation aligns with X)
      dummy.scale.set(0.5, 0.15, 0.3); 
      
      dummy.updateMatrix();
      carsRef.current.setMatrixAt(i, dummy.matrix);
    }
    carsRef.current.instanceMatrix.needsUpdate = true;
  });

  if (roadTiles.length < 2) return null;

  return (
    <instancedMesh ref={carsRef} args={[boxGeo, undefined, carCount]} castShadow>
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
};

const clothesColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff'];

const PopulationSystem = ({ population, grid, gridSize }: { population: number, grid: Grid, gridSize: number }) => {
    const gridToWorld = useMemo(() => getGridToWorld(gridSize), [gridSize]);
    const agentCount = Math.min(Math.floor(population / 2), 300); 
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    // Find tiles where people can walk (Roads, Parks, empty ground)
    const walkableTiles = useMemo(() => {
        const tiles: {x: number, y: number}[] = [];
        grid.forEach(row => row.forEach(tile => {
          if (tile.buildingType === BuildingType.Road || tile.buildingType === BuildingType.Park || tile.buildingType === BuildingType.None) {
            tiles.push({x: tile.x, y: tile.y});
          }
        }));
        return tiles;
    }, [grid]);
    
    const agentsState = useRef<Float32Array>(new Float32Array(0));
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    useEffect(() => {
        if (agentCount === 0 || walkableTiles.length === 0) return;
        agentsState.current = new Float32Array(agentCount * 6);
        const newColors = new Float32Array(agentCount * 3);

        for(let i=0; i<agentCount; i++) {
            const t = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            // Spawn with random offset in tile
            const x = t.x + getRandomRange(-0.4, 0.4);
            const y = t.y + getRandomRange(-0.4, 0.4);

            agentsState.current[i*6+0] = x;
            agentsState.current[i*6+1] = y;
            
            // Initial target
            const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            agentsState.current[i*6+2] = tt.x + getRandomRange(-0.4, 0.4);
            agentsState.current[i*6+3] = tt.y + getRandomRange(-0.4, 0.4);
            
            agentsState.current[i*6+4] = getRandomRange(0.005, 0.015); // speed
            agentsState.current[i*6+5] = Math.random() * Math.PI * 2; // anim

            const c = new THREE.Color(clothesColors[Math.floor(Math.random() * clothesColors.length)]);
            newColors[i*3] = c.r; newColors[i*3+1] = c.g; newColors[i*3+2] = c.b;
        }

        if (meshRef.current) {
            meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
        }
    }, [agentCount, walkableTiles]);

    useFrame((state) => {
        if (!meshRef.current || agentCount === 0 || agentsState.current.length === 0) return;
        const time = state.clock.elapsedTime;

        for(let i=0; i<agentCount; i++) {
            const idx = i*6;
            let x = agentsState.current[idx];
            let y = agentsState.current[idx+1];
            let tx = agentsState.current[idx+2];
            let ty = agentsState.current[idx+3];
            const speed = agentsState.current[idx+4];
            const animOffset = agentsState.current[idx+5];

            const dx = tx - x;
            const dy = ty - y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 0.1) {
                // Pick new random target from walkable
                if (walkableTiles.length > 0) {
                    const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
                    tx = tt.x + getRandomRange(-0.4, 0.4);
                    ty = tt.y + getRandomRange(-0.4, 0.4);
                    agentsState.current[idx+2] = tx;
                    agentsState.current[idx+3] = ty;
                }
            } else {
                x += (dx/dist) * speed;
                y += (dy/dist) * speed;
                agentsState.current[idx] = x;
                agentsState.current[idx+1] = y;
            }

            const [wx, _, wz] = gridToWorld(x, y);

            // Walking bounce
            const bounce = Math.abs(Math.sin(time * 10 + animOffset)) * 0.03;

            // Person dimensions
            const height = 0.2;
            const width = 0.08;
            // Ground level approx -0.3 to -0.4
            const groundY = -0.35; 

            dummy.position.set(wx, groundY + height/2 + bounce, wz);
            dummy.rotation.set(0, -Math.atan2(dy, dx), 0);
            dummy.scale.set(width, height, width);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (agentCount === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[boxGeo, undefined, agentCount]} castShadow>
            <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
    )
};

// Clouds & Birds
const Cloud = ({ position, scale, speed, gridSize }: { position: [number, number, number], scale: number, speed: number, gridSize: number }) => {
    const group = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (group.current) {
            group.current.position.x += speed * delta;
            if (group.current.position.x > gridSize * 1.5) group.current.position.x = -gridSize * 1.5;
        }
    });

    const bubbles = useMemo(() => Array.from({length: 5 + Math.random() * 5}).map(() => ({
        pos: [getRandomRange(-1,1), getRandomRange(-0.5, 0.5), getRandomRange(-1,1)] as [number, number, number],
        scale: getRandomRange(0.5, 1.2)
    })), []);

    return (
        <group ref={group} position={position} scale={scale}>
            {bubbles.map((b, i) => (
                <mesh key={i} geometry={sphereGeo} position={b.pos} scale={b.scale} castShadow>
                    <meshStandardMaterial color="white" flatShading opacity={0.9} transparent />
                </mesh>
            ))}
        </group>
    )
}

const Bird = ({ position, speed, offset, gridSize }: { position: [number, number, number], speed: number, offset: number, gridSize: number }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(ref.current) {
            const time = state.clock.elapsedTime + offset;
            ref.current.position.x = position[0] + Math.sin(time * speed) * gridSize;
            ref.current.position.z = position[1] + Math.cos(time * speed) * gridSize/2;
            ref.current.rotation.y = -time * speed + Math.PI;
            ref.current.scale.y = 1 + Math.sin(time * 15) * 0.3;
        }
    });

    return (
        <group ref={ref} position={[position[0], position[2], position[1]]}>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[0.1,0,0]} rotation={[0, Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[-0.1,0,0]} rotation={[0, -Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
        </group>
    )
}

const EnvironmentEffects = ({ gridSize }: { gridSize: number }) => {
    return (
        <group raycast={() => null}>
             {/* Clouds */}
            <Cloud position={[-12, 8, 4]} scale={1.5} speed={0.3} gridSize={gridSize} />
            <Cloud position={[5, 9, -8]} scale={1.2} speed={0.5} gridSize={gridSize} />
            <Cloud position={[15, 7, 10]} scale={1.8} speed={0.2} gridSize={gridSize} />
            
            {/* Birds */}
            <group position={[0, 0, 0]} scale={0.8}>
                <Bird position={[0, 0, 10]} speed={0.6} offset={0} gridSize={gridSize} />
                <Bird position={[0, 0, 10]} speed={0.6} offset={1.2} gridSize={gridSize} />
                <Bird position={[0, 0, 10]} speed={0.6} offset={2.5} gridSize={gridSize} />
            </group>
            
            {/* Water */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
                <planeGeometry args={[gridSize * 4, gridSize * 4]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.5} opacity={0.8} transparent />
            </mesh>
        </group>
    )
};


// --- Performance Monitor Component ---
const PerformanceMonitor = ({ gridSize, currentLOD, onUpdate }: { 
  gridSize: number, 
  currentLOD: LODLevel,
  onUpdate: (stats: PerformanceStats, recommendation: { recommendedLOD: LODLevel, reason: string, predictedGrowthFactor: number } | null) => void 
}) => {
  const lastAnalysisTime = useRef(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const { gl } = useThree();

  useFrame((state) => {
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / delta);
      const stats: PerformanceStats = {
        fps,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        lodLevel: currentLOD
      };

      // Analyze every 3 minutes (180,000ms) to save quota
      if (now - lastAnalysisTime.current > 180000) {
        lastAnalysisTime.current = now;
        analyzePerformance(stats, gridSize).then(recommendation => {
          if (recommendation) {
            onUpdate(stats, recommendation);
          } else {
            // Fallback heuristic if AI is unavailable
            const fallback = getFallbackRecommendation(stats);
            onUpdate(stats, fallback);
          }
        }).catch(() => {
          // Fallback on error (e.g. rate limit)
          const fallback = getFallbackRecommendation(stats);
          onUpdate(stats, fallback);
        });
      } else {
        onUpdate(stats, null);
      }

      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
};

const getFallbackRecommendation = (stats: PerformanceStats) => {
  let recommendedLOD = stats.lodLevel;
  let reason = "Heuristic: ";
  
  if (stats.fps < 30) {
    recommendedLOD = 'Low';
    reason += "Low FPS detected, prioritizing performance.";
  } else if (stats.fps < 50 && stats.lodLevel === 'High') {
    recommendedLOD = 'Medium';
    reason += "Moderate FPS, balancing visuals.";
  } else if (stats.fps > 55 && stats.lodLevel !== 'High') {
    recommendedLOD = 'High';
    reason += "High FPS, increasing visual quality.";
  } else {
    reason += "Performance stable.";
  }
  
  return { recommendedLOD, reason, predictedGrowthFactor: 1.2 };
};

// --- 3. Main Map Component ---

const RoadMarkings = React.memo(({ x, y, grid, yOffset, gridSize }: { x: number; y: number; grid: Grid; yOffset: number; gridSize: number }) => {
  const lineMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbbf24' }), []);
  const lineGeo = useMemo(() => new THREE.PlaneGeometry(0.1, 0.5), []);

  const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
  const hasDown = y < gridSize - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
  const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
  const hasRight = x < gridSize - 1 && grid[y][x + 1].buildingType === BuildingType.Road;

  const connections = [hasUp, hasDown, hasLeft, hasRight].filter(Boolean).length;
  
  // Isolated road piece: draw a default line
  if (connections === 0) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]} geometry={lineGeo} material={lineMaterial} />
    );
  }

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
      {/* Center point for junctions to fill the gap, lifted slightly to avoid z-fighting */}
      {(hasUp || hasDown) && (hasLeft || hasRight) && (
        <mesh position={[0, 0, 0.005]} material={lineMaterial}>
           <planeGeometry args={[0.12, 0.12]} />
        </mesh>
      )}

      {hasUp && <mesh position={[0, 0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasDown && <mesh position={[0, -0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasLeft && <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
      {hasRight && <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
    </group>
  );
});

interface GroundTileProps {
    type: BuildingType;
    x: number;
    y: number;
    grid: Grid;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
}

// Ground Tile: Handles pointer events and forms base terrain
const GroundTile = React.memo(({ type, x, y, grid, onHover, onLeave, onClick, gridSize, resourceType }: GroundTileProps & { gridSize: number, resourceType?: string }) => {
  const gridToWorld = useMemo(() => getGridToWorld(gridSize), [gridSize]);
  const [wx, _, wz] = gridToWorld(x, y);
  
  let color = '#10b981';
  // Base level for tiles, slightly varying
  let topY = -0.3; 
  let thickness = 0.5;
  
  if (type === BuildingType.None) {
    const noise = getHash(x, y);
    if (resourceType === 'Energy') color = '#fde047'; // Yellow
    else if (resourceType === 'Water') color = '#60a5fa'; // Blue
    else if (resourceType === 'Mineral') color = '#a855f7'; // Purple
    else color = noise > 0.7 ? '#059669' : noise > 0.3 ? '#10b981' : '#34d399';
    
    topY = -0.3 - noise * 0.1; // Slight height variation for grass
  } else if (type === BuildingType.Road) {
    color = '#374151';
    topY = -0.29; // slightly higher
  } else {
    color = '#d1d5db'; // concrete base
    topY = -0.28;
  }

  const centerY = topY - thickness/2;

  return (
    <mesh 
        position={[wx, centerY, wz]} 
        receiveShadow castShadow
        onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
        onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
        onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button === 0) onClick(x, y);
        }}
    >
      <boxGeometry args={[1, thickness, 1]} />
      <meshStandardMaterial color={color} flatShading roughness={1} />
      {type === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={thickness / 2 + 0.001} gridSize={gridSize} />}
      {resourceType && (
        <group position={[0, thickness/2 + 0.1, 0]}>
          <Float speed={2} rotationIntensity={1} floatIntensity={1}>
            <mesh>
              <octahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
          </Float>
        </group>
      )}
    </mesh>
  );
});

// Selection/Hover Cursor
const Cursor = ({ x, y, color, gridSize }: { x: number, y: number, color: string, gridSize: number }) => {
  const gridToWorld = useMemo(() => getGridToWorld(gridSize), [gridSize]);
  const [wx, _, wz] = gridToWorld(x, y);
  return (
    <mesh position={[wx, -0.25, wz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
      <Outlines thickness={0.05} color="white" />
    </mesh>
  );
};


interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  population: number;
  gridSize: number;
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, population, gridSize }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number; gridX: number; gridZ: number } | null>(null);
  const [lodLevel, setLodLevel] = useState<LODLevel>('High');
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
  const [aiReason, setAiReason] = useState<string>('');
  const [growthFactor, setGrowthFactor] = useState<number>(1.2);
  
  const buildingMaterials = useMemo(() => {
    const mats: Record<string, THREE.MeshStandardMaterial> = {};
    Object.entries(BUILDINGS).forEach(([type, config]) => {
      mats[type] = new THREE.MeshStandardMaterial({ 
        color: config.color,
        flatShading: lodLevel !== 'High',
        roughness: lodLevel === 'Low' ? 1 : 0.7,
        metalness: lodLevel === 'High' ? 0.2 : 0
      });
    });
    return mats;
  }, [lodLevel]);

  const gridToWorld = useMemo(() => getGridToWorld(gridSize), [gridSize]);

  const groupedBuildings = useMemo(() => {
    const groups: Record<string, { type: BuildingType, variant: number, hash: number, positions: [number, number, number][] }> = {};
    grid.forEach((row, x) => {
      row.forEach((tile, y) => {
        if (tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road) {
          const hash = getHash(x, y);
          const variant = Math.floor(hash * 100);
          const key = `${tile.buildingType}-${variant}`;
          if (!groups[key]) {
            groups[key] = { type: tile.buildingType, variant, hash, positions: [] };
          }
          const [wx, , wz] = gridToWorld(x, y);
          groups[key].positions.push([wx, 0, wz]);
        }
      });
    });
    return Object.values(groups);
  }, [grid, gridToWorld]);

  const groupedGround = useMemo(() => {
    const groups: Record<string, { color: string, thickness: number, positions: [number, number, number][] }> = {};
    const thickness = 0.5;
    
    grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        let color = '#10b981';
        let topY = -0.3;
        
        if (tile.buildingType === BuildingType.None) {
          const noise = getHash(x, y);
          if (tile.resourceType === 'Energy') color = '#fde047';
          else if (tile.resourceType === 'Water') color = '#60a5fa';
          else if (tile.resourceType === 'Mineral') color = '#a855f7';
          else color = noise > 0.7 ? '#059669' : noise > 0.3 ? '#10b981' : '#34d399';
          topY = -0.3 - noise * 0.1;
        } else if (tile.buildingType === BuildingType.Road) {
          color = '#374151';
          topY = -0.29;
        } else {
          color = '#d1d5db';
          topY = -0.28;
        }

        const centerY = topY - thickness/2;
        const key = `${color}-${thickness}`;
        if (!groups[key]) groups[key] = { color, thickness, positions: [] };
        const [wx, _, wz] = gridToWorld(x, y);
        groups[key].positions.push([wx, centerY, wz]);
      });
    });
    return Object.values(groups);
  }, [grid, gridToWorld]);

  const resourcePositions = useMemo(() => {
    const groups: Record<string, { color: string, positions: [number, number, number][] }> = {};
    grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile.resourceType) {
          let color = '#10b981';
          if (tile.resourceType === 'Energy') color = '#fde047';
          else if (tile.resourceType === 'Water') color = '#60a5fa';
          else if (tile.resourceType === 'Mineral') color = '#a855f7';
          
          if (!groups[color]) groups[color] = { color, positions: [] };
          const [wx, _, wz] = gridToWorld(x, y);
          groups[color].positions.push([wx, 0.3, wz]);
        }
      });
    });
    return Object.values(groups);
  }, [grid, gridToWorld]);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredTile(null);
  }, []);

  // Preview Logic
  const showPreview = hoveredTile && grid[hoveredTile.y][hoveredTile.x].buildingType === BuildingType.None && hoveredTool !== BuildingType.None;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const isBulldoze = hoveredTool === BuildingType.None;
  
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];

  return (
    <div className="absolute inset-0 bg-sky-900 touch-none">
      {/* Performance Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md p-3 rounded-lg border border-white/10 text-white font-mono text-xs pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2 h-2 rounded-full ${lodLevel === 'High' ? 'bg-green-400' : lodLevel === 'Medium' ? 'bg-yellow-400' : 'bg-red-400'}`} />
          <span className="font-bold">AI Graphics Engine: {lodLevel} LOD</span>
        </div>
        {perfStats && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 opacity-80">
            <span>FPS: {perfStats.fps}</span>
            <span>Draw Calls: {perfStats.drawCalls}</span>
            <span>Triangles: {(perfStats.triangles / 1000).toFixed(1)}k</span>
            <span>Objects: {perfStats.geometries}</span>
          </div>
        )}
        {aiReason && <div className="mt-2 text-[10px] italic text-blue-300 max-w-[200px] leading-tight">{aiReason}</div>}
      </div>

      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
        <PerformanceMonitor 
          gridSize={gridSize} 
          currentLOD={lodLevel} 
          onUpdate={(stats, recommendation) => {
            setPerfStats(stats);
            if (recommendation) {
              setLodLevel(recommendation.recommendedLOD);
              setAiReason(recommendation.reason);
              setGrowthFactor(recommendation.predictedGrowthFactor);
            }
          }} 
        />
        <OrthographicCamera makeDefault zoom={45} position={[20, 20, 20]} near={-100} far={200} />
        
        <MapControls 
          enableRotate={true}
          enableZoom={true}
          minZoom={20}
          maxZoom={120}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={0.1}
          target={[0,-0.5,0]}
        />

        <ambientLight intensity={0.5} color="#cceeff" />
        <directionalLight
          castShadow
          position={[15, 20, 10]}
          intensity={2}
          color="#fffbeb"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-15} shadow-camera-right={15}
          shadow-camera-top={15} shadow-camera-bottom={-15}
        >
        </directionalLight>
        <Environment preset="city" />

        <EnvironmentEffects gridSize={gridSize} />

        <group onPointerOut={() => setHoveredTile(null)}>
          {/* Instanced Ground Boxes */}
          {groupedGround.map((group, idx) => (
            <Instances key={`ground-${idx}`} range={Math.ceil(group.positions.length * growthFactor)}>
              <boxGeometry args={[1, group.thickness, 1]} />
              <meshStandardMaterial color={group.color} flatShading roughness={1} />
              {group.positions.map((pos, i) => (
                <Instance key={i} position={pos} />
              ))}
            </Instances>
          ))}

          {/* Instanced Resource Octahedrons */}
          {resourcePositions.map((group, idx) => (
            <Instances key={`res-${idx}`} range={Math.ceil(group.positions.length * growthFactor)}>
              <octahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial color={group.color} emissive={group.color} emissiveIntensity={0.5} />
              {group.positions.map((pos, i) => (
                <Instance key={i} position={pos} />
              ))}
            </Instances>
          ))}

          {/* Invisible event layer for clicks/hover */}
          <mesh 
            rotation-x={-Math.PI / 2} 
            position={[0, 0.05, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              const offset = gridSize / 2 - 0.5;
              const x = Math.floor(e.point.x + offset + 0.5);
              const z = Math.floor(e.point.z + offset + 0.5);
              if (x >= 0 && x < gridSize && z >= 0 && z < gridSize) {
                touchStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  time: Date.now(),
                  gridX: x,
                  gridZ: z
                };
              }
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (!touchStartRef.current) return;
              
              const start = touchStartRef.current;
              touchStartRef.current = null;
              
              const dx = e.clientX - start.x;
              const dy = e.clientY - start.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const duration = Date.now() - start.time;
              
              // If the pointer didn't move much and was down for a reasonable time (tap)
              if (dist < 15 && duration < 350) {
                onTileClick(start.gridX, start.gridZ);
              }
            }}
            onPointerMove={(e) => {
              const offset = gridSize / 2 - 0.5;
              const x = Math.floor(e.point.x + offset + 0.5);
              const z = Math.floor(e.point.z + offset + 0.5);
              if (x >= 0 && x < gridSize && z >= 0 && z < gridSize) {
                handleHover(x, z);
              }
            }}
            onPointerOut={handleLeave}
          >
            <planeGeometry args={[gridSize, gridSize]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          {/* Road Markings and Tile Status Badges */}
          {grid.map((row, y) => row.map((tile, x) => {
            const [wx, _, wz] = gridToWorld(x, y);
            const hasBuilding = tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road;
            const needsStatus = hasBuilding && (tile.isPowered === false || tile.hasWater === false || tile.isIncomeGenerating);
            
            // Adjust floating indicator height proportional to default building scales
            let badgeY = 1.3;
            if (tile.buildingType === BuildingType.Commercial) {
              const hash = getHash(x, y);
              badgeY = 1.7 + hash * 1.5;
            } else if (tile.buildingType === BuildingType.Residential) {
              badgeY = 0.9;
            } else if (tile.buildingType === BuildingType.Industrial) {
              badgeY = 1.1;
            } else if (tile.buildingType === BuildingType.Extractor) {
              badgeY = 0.8;
            }

            return (
              <React.Fragment key={`${x}-${y}`}>
                {tile.buildingType === BuildingType.Road && (
                  <group position={[wx, 0, wz]}>
                    <RoadMarkings x={x} y={y} grid={grid} yOffset={0.211} gridSize={gridSize} />
                  </group>
                )}

                {needsStatus && (
                  <group position={[wx, badgeY, wz]}>
                    <Html distanceFactor={14} center pointerEvents="none">
                      <div className="flex gap-1 bg-gray-900/90 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-gray-700 shadow-xl select-none text-[8px] md:text-[9px] font-sans items-center pointer-events-none scale-90 transition-all">
                        {/* Under-powered warning */}
                        {tile.isPowered === false && (
                          <span title="Underpowered (Efficiency halved)" className="text-yellow-400 animate-pulse font-extrabold flex items-center">
                            ⚡
                          </span>
                        )}
                        {/* Water warning */}
                        {tile.hasWater === false && (
                          <span title="No water connection (Efficiency halved)" className="text-cyan-400 animate-pulse font-extrabold flex items-center">
                            💧
                          </span>
                        )}
                        {/* Generating revenue indicator */}
                        {tile.isIncomeGenerating && (
                          <span title="Active revenue stream" className="text-green-400 font-extrabold flex items-center animate-bounce">
                            $
                          </span>
                        )}
                      </div>
                    </Html>
                  </group>
                )}
              </React.Fragment>
            );
          }))}

          {/* Buildings - Instanced */}
          {groupedBuildings.map((group, idx) => {
            const mainMat = buildingMaterials[group.type];
            
            return (
              <Instances key={`build-group-${idx}`} range={Math.ceil(group.positions.length * growthFactor)}>
                <boxGeometry args={[1, 1, 1]} />
                <primitive object={mainMat} attach="material" />
                {group.positions.map((pos, i) => {
                  let scale: [number, number, number] = [0.7, 0.6, 0.6];
                  let yPos = 0.3;
                  
                  if (group.type === BuildingType.Commercial) {
                    const height = 1.5 + group.hash * 1.5;
                    scale = [0.7, height, 0.7];
                    yPos = height / 2;
                  } else if (group.type === BuildingType.Industrial) {
                    scale = [0.9, 0.8, 0.8];
                    yPos = 0.4;
                  } else if (group.type === BuildingType.Extractor) {
                    scale = [0.55, 1.1, 0.55]; // Tall, slender mining/pumping rig
                    yPos = 0.55;
                  }
                  
                  return (
                    <Instance 
                      key={i} 
                      position={[pos[0], yPos, pos[2]]} 
                      scale={scale}
                    />
                  );
                })}
              </Instances>
            );
          })}

          {/* Visual Elements - disable pointer events */}
          <group raycast={() => null}>
            <TrafficSystem grid={grid} gridSize={gridSize} />
            <PopulationSystem population={population} grid={grid} gridSize={gridSize} />

            {/* Placement Preview */}
            {showPreview && hoveredTile && (
              <group position={[previewPos[0], 0, previewPos[2]]}>
                <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                  <ProceduralBuilding 
                    type={hoveredTool} 
                    baseColor={previewColor} 
                    x={hoveredTile.x} 
                    y={hoveredTile.y} 
                    transparent 
                    opacity={0.7} 
                  />
                </Float>
              </group>
            )}

            {/* Highlight */}
            {hoveredTile && (
              <Cursor 
                x={hoveredTile.x} 
                y={hoveredTile.y} 
                color={isBulldoze ? '#ef4444' : (showPreview ? '#ffffff' : '#000000')} 
                gridSize={gridSize}
              />
            )}
          </group>
        </group>
        
        <SoftShadows size={10} samples={8} />
      </Canvas>
    </div>
  );
};

export default IsoMap;