// FILE: /video-platform/client-web/src/components/watch-party/scene/VirtualRoom.tsx
/**
 * 3D 虚拟电影院房间
 * - 反射地板
 * - 霓虹边框大屏幕
 * - 移除 Text3D 避免字体加载失败
 */

import React from 'react';
import { MeshReflectorMaterial, Html, useTexture } from '@react-three/drei';

interface VirtualRoomProps {
    videoElement?: HTMLVideoElement | null;
    showVideo?: boolean;
}

export const VirtualRoom: React.FC<VirtualRoomProps> = ({ videoElement, showVideo = false }) => {
    return (
        <group>
            {/* Floor with Reflection */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
                <planeGeometry args={[50, 50]} />
                <MeshReflectorMaterial
                    blur={[300, 100]}
                    resolution={1024}
                    mixBlur={1}
                    mixStrength={40}
                    roughness={1}
                    depthScale={1.2}
                    minDepthThreshold={0.4}
                    maxDepthThreshold={1.4}
                    color="#150520"
                    metalness={0.5}
                    mirror={0.5}
                />
            </mesh>

            {/* Screen Frame (Neon Border) */}
            <mesh position={[0, 4, -8]}>
                <boxGeometry args={[16.5, 9.5, 0.5]} />
                <meshStandardMaterial color="#111" />
            </mesh>

            {/* Neon glow behind screen */}
            <mesh position={[0, 4, -8.3]}>
                <boxGeometry args={[17, 10, 0.5]} />
                <meshBasicMaterial color="#ff0080" />
            </mesh>

            {/* Video Screen Placeholder or Actual Content */}
            <Html
                transform
                position={[0, 4, -7.7]}
                rotation={[0, 0, 0]}
                occlude
                style={{
                    width: '960px',
                    height: '540px',
                    background: 'black',
                    border: '2px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {showVideo && videoElement ? (
                    <div style={{ width: '100%', height: '100%', background: '#000' }}>
                        {/* Video will be controlled externally */}
                        <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#00f3ff',
                            fontSize: '24px',
                            fontFamily: 'monospace'
                        }}>
                            ▶ 视频播放中
                        </div>
                    </div>
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #0a0a1a, #1a0a2a)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                    }}>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '16px',
                            animation: 'pulse 2s infinite'
                        }}>
                            🎬
                        </div>
                        <div style={{
                            fontSize: '24px',
                            fontFamily: "'Orbitron', monospace",
                            color: '#00f3ff',
                            textShadow: '0 0 10px #00f3ff'
                        }}>
                            等待开始...
                        </div>
                    </div>
                )}
            </Html>

            {/* Decorative neon lines on floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 2]}>
                <planeGeometry args={[8, 0.1]} />
                <meshBasicMaterial color="#00f3ff" transparent opacity={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 3]}>
                <planeGeometry args={[6, 0.05]} />
                <meshBasicMaterial color="#bc13fe" transparent opacity={0.4} />
            </mesh>
        </group>
    );
};

export default VirtualRoom;
