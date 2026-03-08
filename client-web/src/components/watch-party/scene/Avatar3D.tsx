import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group } from 'three';

interface Avatar3DProps {
    position: [number, number, number];
    color: string;
    isSelf?: boolean;
}

export const Avatar3D: React.FC<Avatar3DProps> = ({ position, color, isSelf }) => {
    const groupRef = useRef<Group>(null);

    // Simple idle animation
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.05;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Body: Capsule with Strong Neon Glow */}
            <mesh position={[0, 0.6, 0]}>
                <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={2} // Intense Glow
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>

            {/* Local Light for that "Cyberpunk Character" feel */}
            <pointLight position={[0, 1, 0]} color={color} distance={3} intensity={2} />

            {/* Head: Sphere */}
            <mesh position={[0, 1.3, 0]}>
                <sphereGeometry args={[0.25, 32, 32]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#ffffff"
                    emissiveIntensity={0.5}
                    roughness={0.1}
                    metalness={0.5}
                />
            </mesh>

            {/* Selection Ring (for self) */}
            {isSelf && (
                <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.4, 0.5, 32]} />
                    <meshBasicMaterial color="#00ffcc" transparent opacity={0.5} />
                </mesh>
            )}
        </group>
    );
};
