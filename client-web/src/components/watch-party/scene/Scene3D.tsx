// FILE: /video-platform/client-web/src/components/watch-party/scene/Scene3D.tsx
/**
 * 3D 场景容器
 * - React Three Fiber Canvas
 * - 灯光、相机、控制器
 * - 错误边界保护
 */

import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { VirtualRoom } from './VirtualRoom';
import { Avatar3D } from './Avatar3D';
import type { Participant } from '../../../hooks/useWatchPartySync';

interface Scene3DProps {
    participants?: Participant[];
    currentUserId?: string;
    showVideo?: boolean;
}

// Error fallback
const ErrorFallback = () => (
    <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a, #1a0a2a)',
        color: '#ff6b9d',
        flexDirection: 'column',
        gap: '16px'
    }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <div style={{ fontSize: '18px' }}>3D 场景加载失败</div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>请刷新页面重试</div>
    </div>
);

// Loading fallback
const LoadingFallback = () => (
    <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a, #1a0a2a)',
        color: '#00f3ff'
    }}>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
        }}>
            <div className="wp-loading-spinner" />
            <div style={{ fontFamily: "'Orbitron', monospace" }}>正在加载 3D 场景...</div>
        </div>
    </div>
);

export const Scene3D: React.FC<Scene3DProps> = ({
    participants = [],
    currentUserId = '',
    showVideo = false
}) => {
    const [hasError, setHasError] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <LoadingFallback />;
    }

    if (hasError) {
        return <ErrorFallback />;
    }

    // Calculate avatar positions in a semi-circle
    const getAvatarPosition = (index: number, total: number): [number, number, number] => {
        const radius = 4;
        const angleSpan = Math.PI * 0.6; // 108 degrees
        const startAngle = Math.PI * 0.7; // Start from left
        const angle = startAngle + (angleSpan * index) / Math.max(total - 1, 1);
        return [
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius + 2
        ];
    };

    // Avatar colors
    const colors = ['#00ffcc', '#ff00ff', '#ffff00', '#00f3ff', '#ff0080', '#00ff9f'];

    return (
        <div style={{ width: '100%', height: '100vh', background: '#050510' }}>
            <Canvas
                shadows
                camera={{ position: [0, 2, 8], fov: 50 }}
                onError={() => setHasError(true)}
            >
                <fog attach="fog" args={['#050510', 10, 40]} />

                {/* Lights */}
                <ambientLight intensity={0.5} />
                <spotLight
                    position={[10, 10, 10]}
                    angle={0.15}
                    penumbra={1}
                    intensity={1}
                    castShadow
                />
                <pointLight position={[-10, 5, -10]} color="cyan" intensity={0.5} />
                <pointLight position={[10, 5, -10]} color="magenta" intensity={0.5} />

                <Suspense fallback={null}>
                    <VirtualRoom showVideo={showVideo} />

                    {/* Render avatars for participants */}
                    {participants.length > 0 ? (
                        participants.map((p, i) => (
                            <Avatar3D
                                key={p.id}
                                position={getAvatarPosition(i, participants.length)}
                                color={colors[i % colors.length]}
                                isSelf={p.id === currentUserId}
                            />
                        ))
                    ) : (
                        // Default avatars for demo
                        <>
                            <Avatar3D position={[0, 0, 0]} color="#00ffcc" isSelf />
                            <Avatar3D position={[-2, 0, 0.5]} color="#ff00ff" />
                            <Avatar3D position={[2, 0, 0.5]} color="#ffff00" />
                        </>
                    )}

                    <Environment preset="city" />
                    <ContactShadows
                        resolution={1024}
                        scale={20}
                        blur={2}
                        opacity={0.5}
                        far={10}
                        color="#000000"
                    />
                </Suspense>

                <OrbitControls
                    maxPolarAngle={Math.PI / 2}
                    minDistance={5}
                    maxDistance={15}
                    enablePan={false}
                />
            </Canvas>
        </div>
    );
};

export default Scene3D;
