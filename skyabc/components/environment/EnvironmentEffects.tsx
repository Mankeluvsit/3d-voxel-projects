import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE } from '../../constants';
import { getRandomRange, sphereGeo, boxGeo } from '../../lib/3dUtils';
import { LODContext } from '../../lib/contexts';

export const Cloud = ({ position, scale, speed }: { position: [number, number, number], scale: number, speed: number }) => {
    const group = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (group.current) {
            group.current.position.x += speed * delta;
            if (group.current.position.x > GRID_SIZE * 1.5) group.current.position.x = -GRID_SIZE * 1.5;
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

export const Bird = ({ position, speed, offset }: { position: [number, number, number], speed: number, offset: number }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(ref.current) {
            const time = state.clock.elapsedTime + offset;
            ref.current.position.x = position[0] + Math.sin(time * speed) * GRID_SIZE;
            ref.current.position.z = position[1] + Math.cos(time * speed) * GRID_SIZE/2;
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

export const EnvironmentEffects = ({ day }: { day: number }) => {
    // Dynamic background color based on day cycle (24h period)
    const timeOfDay = (day % 24) / 24; // 0 to 1
    const { scene } = useThree();
    
    useEffect(() => {
        // Change background color based on time
        if (timeOfDay < 0.25) scene.background = new THREE.Color("#0c4a6e"); // Night to early morning
        else if (timeOfDay < 0.5) scene.background = new THREE.Color("#e0f2fe"); // Day
        else if (timeOfDay < 0.75) scene.background = new THREE.Color("#f59e0b"); // Sunset
        else scene.background = new THREE.Color("#1e293b"); // Evening to Night
    }, [timeOfDay, scene]);

    const { lodLevel } = React.useContext(LODContext);

    return (
        <group raycast={() => null}>
             {/* Clouds - only render if lodLevel is high to maximize FPS */}
            {lodLevel === 'high' && (
                <>
                    <Cloud position={[-12, 8, 4]} scale={1.5} speed={0.3} />
                    <Cloud position={[5, 9, -8]} scale={1.2} speed={0.5} />
                    <Cloud position={[15, 7, 10]} scale={1.8} speed={0.2} />
                </>
            )}
            
            {/* Birds - only render if lodLevel is high */}
            {lodLevel === 'high' && (
                <group position={[0, 0, 0]} scale={0.8}>
                    <Bird position={[0, 0, 10]} speed={0.6} offset={0} />
                    <Bird position={[0, 0, 10]} speed={0.6} offset={1.2} />
                    <Bird position={[0, 0, 10]} speed={0.6} offset={2.5} />
                </group>
            )}

            {/* Water */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
                <planeGeometry args={[GRID_SIZE * 4, GRID_SIZE * 4]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.5} opacity={0.8} transparent />
            </mesh>
        </group>
    )
};
