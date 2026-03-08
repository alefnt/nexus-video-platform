// FILE: /video-platform/client-web/src/components/watch-party/ParticipantList.tsx
/**
 * Watch Party 参与者列表
 * - 显示在线用户
 * - 房主标识
 * - 在线状态
 */

import React from 'react';
import { Crown, User, Wifi } from 'lucide-react';
import type { Participant } from '../../hooks/useWatchPartySync';

interface ParticipantListProps {
    participants: Participant[];
    currentUserId: string;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
    participants,
    currentUserId
}) => {
    const isOnline = (lastSeen: number) => Date.now() - lastSeen < 30000;

    return (
        <div className="wp-participants">
            <div className="wp-participants-header">
                <User size={16} />
                <span>在线观众</span>
                <span className="wp-participant-count">{participants.length}</span>
            </div>

            <div className="wp-participant-list">
                {participants.map((p) => (
                    <div
                        key={p.id}
                        className={`wp-participant ${p.id === currentUserId ? 'self' : ''} ${p.isHost ? 'host' : ''}`}
                    >
                        <div className="wp-participant-avatar">
                            {p.avatar ? (
                                <img src={p.avatar} alt={p.name} />
                            ) : (
                                <div className="wp-avatar-placeholder" style={{
                                    background: p.isHost ? 'linear-gradient(135deg, #ff0080, #ff8c00)' : 'linear-gradient(135deg, #00f3ff, #bc13fe)'
                                }}>
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {p.isHost && (
                                <div className="wp-host-badge">
                                    <Crown size={10} />
                                </div>
                            )}
                        </div>

                        <div className="wp-participant-info">
                            <span className="wp-participant-name">
                                {p.name}
                                {p.id === currentUserId && ' (你)'}
                            </span>
                            <span className={`wp-participant-status ${isOnline(p.lastSeen) ? 'online' : 'offline'}`}>
                                <Wifi size={10} />
                                {isOnline(p.lastSeen) ? '在线' : '离线'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ParticipantList;
