import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { Grid, BuildingType } from '../../types';
import { gridToWorld, getRandomRange, boxGeo } from '../../lib/3dUtils';
import { getTerrainHeight } from '../../lib/terrainUtils';

const carColors = ['#ef4444', '#3b82f6', '#eab308', '#ffffff', '#1f2937', '#f97316'];

export const TrafficSystem = ({ grid }: { grid: Grid }) => {
  const roadTiles = useMemo(() => {
    const roads: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      if (tile.buildingType === BuildingType.Road) roads.push({x: tile.x, y: tile.y});
    }));
    return roads;
  }, [grid]);

  const policeStations = useMemo(() => {
    const stations: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      if (tile.buildingType === BuildingType.PoliceStation) stations.push({x: tile.x, y: tile.y});
    }));
    return stations;
  }, [grid]);

  const intersectionCache = useMemo(() => {
    const intersections = new Set<string>();
    roadTiles.forEach(t => {
        const conns = roadTiles.filter(t2 => (Math.abs(t2.x - t.x) === 1 && t2.y === t.y) || (Math.abs(t2.y - t.y) === 1 && t2.x === t.x));
        if (conns.length > 2) intersections.add(`${t.x},${t.y}`);
    });
    return intersections;
  }, [roadTiles]);

  const carCount = Math.min(roadTiles.length, 30);
  const policeCarCount = Math.min(policeStations.length * 2, 10);
  
  const carsRef = useRef<THREE.InstancedMesh>(null);
  const carsCabRef = useRef<THREE.InstancedMesh>(null);
  const policeCarsRef = useRef<THREE.InstancedMesh>(null);
  const policeCarsCabRef = useRef<THREE.InstancedMesh>(null);
  
  // Combine car states (8 floats per car: curX, curY, tarX, tarY, progress, speed, type, followDist)
  const CAR_STATE_LEN = 8;
  const carsState = useRef<Float32Array>(new Float32Array(0));
  const policeCarsState = useRef<Float32Array>(new Float32Array(0));
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (roadTiles.length < 2) return;
    
    // Normal cars
    carsState.current = new Float32Array(carCount * CAR_STATE_LEN);
    const newColors = new Float32Array(carCount * 3);
    for (let i = 0; i < carCount; i++) {
      const startNode = roadTiles[Math.floor(Math.random() * roadTiles.length)];
      carsState.current[i*CAR_STATE_LEN + 0] = startNode.x;
      carsState.current[i*CAR_STATE_LEN + 1] = startNode.y;
      carsState.current[i*CAR_STATE_LEN + 2] = startNode.x;
      carsState.current[i*CAR_STATE_LEN + 3] = startNode.y;
      carsState.current[i*CAR_STATE_LEN + 4] = 1; 
      carsState.current[i*CAR_STATE_LEN + 5] = getRandomRange(0.008, 0.04); // more varied speed
      carsState.current[i*CAR_STATE_LEN + 6] = Math.floor(Math.random() * 3); // type 0,1,2
      carsState.current[i*CAR_STATE_LEN + 7] = getRandomRange(0.4, 0.7); // randomized follow distance

      const color = new THREE.Color(carColors[Math.floor(Math.random() * carColors.length)]);
      newColors[i*3] = color.r; newColors[i*3+1] = color.g; newColors[i*3+2] = color.b;
    }
    if (carsRef.current) carsRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
    if (carsCabRef.current) carsCabRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);

    // Police cars
    if (policeStations.length > 0) {
        policeCarsState.current = new Float32Array(policeCarCount * CAR_STATE_LEN);
        const policeColors = new Float32Array(policeCarCount * 3);
        for (let i = 0; i < policeCarCount; i++) {
        const startNode = policeStations[Math.floor(Math.random() * policeStations.length)];
        // Find nearest road
        const road = roadTiles.sort((a,b) => Math.abs(a.x - startNode.x) - Math.abs(b.x-startNode.x))[0];
        policeCarsState.current[i*CAR_STATE_LEN + 0] = road.x;
        policeCarsState.current[i*CAR_STATE_LEN + 1] = road.y;
        policeCarsState.current[i*CAR_STATE_LEN + 2] = road.x;
        policeCarsState.current[i*CAR_STATE_LEN + 3] = road.y;
        policeCarsState.current[i*CAR_STATE_LEN + 4] = 1;
        policeCarsState.current[i*CAR_STATE_LEN + 5] = getRandomRange(0.03, 0.05); // Faster
        policeCarsState.current[i*CAR_STATE_LEN + 6] = 0; // Police is always sedan
        policeCarsState.current[i*CAR_STATE_LEN + 7] = getRandomRange(0.3, 0.5); // Aggressive follow

        policeColors[i*3] = 1; policeColors[i*3+1] = 1; policeColors[i*3+2] = 1; // White/Blue
        }
        if (policeCarsRef.current) policeCarsRef.current.instanceColor = new THREE.InstancedBufferAttribute(policeColors, 3);
        if (policeCarsCabRef.current) policeCarsCabRef.current.instanceColor = new THREE.InstancedBufferAttribute(policeColors, 3);
    }
  }, [roadTiles, carCount, policeStations, policeCarCount, CAR_STATE_LEN]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Helper to update car matrix
    const updateCar = (bodyRef: THREE.InstancedMesh, cabRef: THREE.InstancedMesh, cState: Float32Array, i: number, allStatesList: Float32Array[]) => {
        const idx = i * CAR_STATE_LEN;
        let curX = cState[idx];
        let curY = cState[idx+1];
        let tarX = cState[idx+2];
        let tarY = cState[idx+3];
        let progress = cState[idx+4];
        const speed = cState[idx+5];
        const type = cState[idx+6];
        const followDist = cState[idx+7];

        let proceed = true;
        
        // Traffic light intersection logic
        if (intersectionCache.has(`${tarX},${tarY}`) && progress < 0.45 && progress + speed >= 0.45) {
            const isHorizontal = Math.abs(tarX - curX) > 0;
            const offset = isHorizontal ? 5 : 0;
            const cycle = Math.floor(time + offset) % 10;
            // Stop on yellow (4) and red (5-9)
            if (cycle >= 4) {
                proceed = false;
                progress = 0.44; // Stop right before the intersection center
            }
        }

        // Car following collision logic
        if (proceed) {
            for (const states of allStatesList) {
                const count = states.length / CAR_STATE_LEN;
                for (let j = 0; j < count; j++) {
                    if (states === cState && j === i) continue;
                    
                    const jCurX = states[j*CAR_STATE_LEN];
                    const jCurY = states[j*CAR_STATE_LEN+1];
                    const jTarX = states[j*CAR_STATE_LEN+2];
                    const jTarY = states[j*CAR_STATE_LEN+3];
                    const jProgress = states[j*CAR_STATE_LEN+4];
                    
                    if (curX === jCurX && curY === jCurY && tarX === jTarX && tarY === jTarY) {
                        if (jProgress > progress && jProgress - progress < followDist) {
                            proceed = false;
                            progress = jProgress - followDist;
                            break;
                        }
                    } else if (tarX === jCurX && tarY === jCurY) {
                        const dist = (1.0 - progress) + jProgress;
                        if (progress > (1.0 - followDist) && dist < followDist) {
                            proceed = false;
                            progress = 1.0 - (followDist - jProgress);
                            break;
                        }
                    }
                }
                if (!proceed) break;
            }
        }

        if (proceed) {
            progress += speed;
        }
        
        if (progress >= 1) {
            curX = tarX; curY = tarY; progress = 0;
            const neighbors = roadTiles.filter(t => (Math.abs(t.x - curX) === 1 && t.y === curY) || (Math.abs(t.y - curY) === 1 && t.x === curX));
            if (neighbors.length > 0) {
                // Ensure we don't go backwards immediately if there are other options
                const valid = neighbors.length > 1 
                    ? neighbors.filter(n => Math.abs(n.x - cState[idx]) > 0.1 || Math.abs(n.y - cState[idx+1]) > 0.1)
                    : neighbors;
                const next = valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : neighbors[0];
                tarX = next.x; tarY = next.y;
            }
        }
        cState[idx] = curX; cState[idx+1] = curY; cState[idx+2] = tarX; cState[idx+3] = tarY; cState[idx+4] = progress;
        
        const gx = MathUtils.lerp(curX, tarX, progress);
        const gy = MathUtils.lerp(curY, tarY, progress);
        
        // Right side offset
        const dx = tarX - curX || 0.001; // Avoid divide by 0
        const dy = tarY - curY || 0.001;
        const len = Math.sqrt(dx*dx + dy*dy);
        const offsetAmt = 0.2; // Move slightly right
        const offX = (-dy/len) * offsetAmt;
        const offY = (dx/len) * offsetAmt;

        const [wx, _, wz] = gridToWorld(gx + offX, gy + offY);
        const [targetX, __, targetZ] = gridToWorld(tarX + offX, tarY + offY);
        
        // Exact height from terrain on current pos and target pos
        const baseHeight = getTerrainHeight(gx + offX + 0.5, gy + offY + 0.5, grid) + 0.05;
        const targetHeight = getTerrainHeight(tarX + offX + 0.5, tarY + offY + 0.5, grid) + 0.05;
        
        let bodyScale = [0.18, 0.1, 0.35];
        let cabScale = [0.14, 0.1, 0.18];
        let cabOffset = -0.05;
        let bodyOffset = 0.05;
        
        if (type === 1) { // Pickup
            bodyScale = [0.18, 0.08, 0.4];
            cabScale = [0.14, 0.1, 0.15];
            cabOffset = -0.1;
            bodyOffset = 0.04;
        } else if (type === 2) { // Truck/Van
            bodyScale = [0.18, 0.16, 0.4];
            cabScale = [0.14, 0.1, 0.12];
            cabOffset = -0.15;
            bodyOffset = 0.08;
        }

        // Body
        dummy.position.set(wx, baseHeight + bodyOffset, wz);
        dummy.lookAt(targetX, targetHeight + bodyOffset, targetZ);
        dummy.scale.set(bodyScale[0], bodyScale[1], bodyScale[2]); 
        dummy.updateMatrix();
        bodyRef.setMatrixAt(i, dummy.matrix);
        
        // Cab
        dummy.position.set(wx, baseHeight + bodyOffset * 2 + (cabScale[1] / 2), wz);
        dummy.lookAt(targetX, targetHeight + bodyOffset * 2 + (cabScale[1] / 2), targetZ);
        dummy.translateZ(cabOffset); // move backwards slightly in local space
        dummy.scale.set(cabScale[0], cabScale[1], cabScale[2]);
        dummy.updateMatrix();
        cabRef.setMatrixAt(i, dummy.matrix);
    }

    const allCarStates = [];
    if (carsState.current.length > 0) allCarStates.push(carsState.current);
    if (policeCarsState.current.length > 0) allCarStates.push(policeCarsState.current);

    if (carsRef.current && carsCabRef.current && carsState.current.length > 0) {
        for (let i = 0; i < carCount; i++) {
            updateCar(carsRef.current, carsCabRef.current, carsState.current, i, allCarStates);
        }
        carsRef.current.instanceMatrix.needsUpdate = true;
        carsCabRef.current.instanceMatrix.needsUpdate = true;
    }
    
    if (policeCarsRef.current && policeCarsCabRef.current && policeCarsState.current.length > 0) {
        for (let i = 0; i < policeCarCount; i++) {
            updateCar(policeCarsRef.current, policeCarsCabRef.current, policeCarsState.current, i, allCarStates);
        }
        policeCarsRef.current.instanceMatrix.needsUpdate = true;
        policeCarsCabRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (roadTiles.length < 2) return null;

  return (
    <group>
      <instancedMesh ref={carsRef} args={[boxGeo, undefined, carCount]}>
        <meshStandardMaterial roughness={0.5} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={carsCabRef} args={[boxGeo, undefined, carCount]}>
        <meshStandardMaterial roughness={0.5} metalness={0.3} />
      </instancedMesh>
      {policeStations.length > 0 && (
        <group>
            <instancedMesh ref={policeCarsRef} args={[boxGeo, undefined, policeCarCount]}>
                <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.5} />
            </instancedMesh>
            <instancedMesh ref={policeCarsCabRef} args={[boxGeo, undefined, policeCarCount]}>
                <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.5} />
            </instancedMesh>
        </group>
       )}
    </group>
  );
};
