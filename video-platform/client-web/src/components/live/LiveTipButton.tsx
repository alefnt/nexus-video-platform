// FILE: /video-platform/client-web/src/components/live/LiveTipButton.tsx
/**
 * 直播打赏按钮组件 (Nexus Prime Sytle)
 */

import React, { useState, useEffect } from 'react';
import { getApiClient } from '../../lib/apiClient';
import { triggerGiftEffect } from './LiveGiftEffect';

interface Gift {
    id: string;
    name: string;
    icon: string;
    price: number;
    animation?: string;
}

interface LiveTipButtonProps {
    roomId: string;
    onTipSuccess?: (tip: any) => void;
    onTipError?: (error: string) => void;
    className?: string;
}

const client = getApiClient();

export default function LiveTipButton({
    roomId,
    onTipSuccess,
    onTipError,
    className = '',
}: LiveTipButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [gifts, setGifts] = useState<Gift[]>([]);
    const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);

    // 获取JWT
    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);

    // 加载礼物列表
    useEffect(() => {
        loadGifts();
        // Fetch balance
        client.get<{ balance: number }>('/payment/points/balance')
            .then(res => setBalance(res?.balance ?? null))
            .catch(() => { });
    }, []);

    const loadGifts = async () => {
        try {
            const res = await client.get<{ gifts: Gift[] }>('/live/gifts');
            setGifts(res.gifts || []);
            if (res.gifts?.length > 0) {
                setSelectedGift(res.gifts[0]);
            }
        } catch (err) {
            console.error('Load gifts failed:', err);
        }
    };

    const handleSendGift = async () => {
        if (!selectedGift) return;

        setLoading(true);
        setError(null);

        try {
            const res = await client.post<{
                ok: boolean;
                tip: {
                    id: string;
                    fromName?: string;
                    amount: number;
                };
                gift: Gift;
                senderBalance?: number;
            }>('/live/tip', {
                roomId,
                giftId: selectedGift.id,
                message: message.trim() || undefined,
            });

            if (res.ok) {
                // 触发特效
                if (selectedGift.animation) {
                    triggerGiftEffect({
                        id: res.tip.id,
                        type: 'gift',
                        animation: selectedGift.animation,
                        fromName: res.tip.fromName || '我',
                        amount: res.tip.amount,
                        giftIcon: selectedGift.icon,
                        giftName: selectedGift.name,
                    });
                }

                setIsOpen(false);
                setMessage('');
                if (res.senderBalance !== undefined) setBalance(res.senderBalance);
                onTipSuccess?.(res.tip);
            }
        } catch (err: any) {
            const errorMsg = err?.error || err?.message || '打赏失败';
            setError(errorMsg);
            onTipError?.(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`live-tip-button-container ${className}`}>
            <style>{`
                .live-tip-button-container {
                    position: relative;
                }

                .tip-trigger-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 10px 24px;
                    background: rgba(255,215,0,0.1);
                    border: 1px solid rgba(255,215,0,0.3);
                    border-radius: 99px;
                    color: #FFD700;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .tip-trigger-btn:hover {
                    background: rgba(255,215,0,0.2);
                    box-shadow: 0 0 20px rgba(255,215,0,0.3);
                    transform: translateY(-1px);
                }

                .gift-panel {
                    position: absolute;
                    bottom: calc(100% + 16px);
                    right: 0;
                    width: 380px;
                    background: rgba(10, 10, 15, 0.95);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 20px;
                    padding: 20px;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 0 50px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05);
                    z-index: 1000;
                    animation: panelScaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    transform-origin: bottom right;
                }

                @keyframes panelScaleUp {
                    from { 
                        opacity: 0;
                        transform: scale(0.9) translateY(10px);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding-bottom: 15px;
                }

                .panel-header h4 {
                    margin: 0;
                    font-size: 14px;
                    color: #fff;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    font-weight: 800;
                    background: linear-gradient(to right, #fff, #888);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .close-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    font-size: 24px;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0;
                }

                .gift-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .gift-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 12px 6px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }

                .gift-item:hover {
                    background: rgba(255,255,255,0.08);
                    transform: translateY(-2px);
                }

                .gift-item.selected {
                    border-color: #FFD700;
                    background: rgba(255,215,0,0.05);
                    box-shadow: 0 0 15px rgba(255,215,0,0.1);
                }

                .gift-item .icon {
                    font-size: 32px;
                    filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));
                    transition: transform 0.2s;
                }
                
                .gift-item:hover .icon {
                    transform: scale(1.1);
                }

                .gift-item .name {
                    font-size: 10px;
                    color: rgba(255,255,255,0.6);
                    font-weight: 500;
                }

                .gift-item .price {
                    font-size: 10px;
                    color: #FFD700;
                    font-weight: 700;
                }

                .input-group {
                    background: rgba(0,0,0,0.3);
                    border-radius: 12px;
                    padding: 4px;
                    border: 1px solid rgba(255,255,255,0.1);
                    margin-bottom: 12px;
                }

                .message-input {
                    width: 100%;
                    padding: 12px;
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 13px;
                    outline: none;
                }

                .error-msg {
                    color: #ff4757;
                    font-size: 12px;
                    margin-bottom: 12px;
                    padding: 10px;
                    background: rgba(255, 71, 87, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 71, 87, 0.2);
                }

                .send-btn {
                    width: 100%;
                    padding: 16px;
                    background: linear-gradient(135deg, #FFD700, #FFA500);
                    border: none;
                    border-radius: 12px;
                    color: #000;
                    font-weight: 800;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .send-btn::after {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(rgba(255,255,255,0.2), transparent);
                    transform: rotate(45deg);
                    animation: shine 3s infinite;
                }

                @keyframes shine {
                    0% { transform: translateX(-100%) rotate(45deg); }
                    100% { transform: translateX(100%) rotate(45deg); }
                }

                .send-btn:hover:not(:disabled) {
                    transform: scale(1.02);
                    box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
                }

                .send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    filter: grayscale(100%);
                }
            `}</style>

            {/* 打赏按钮 */}
            <button className="tip-trigger-btn group" onClick={() => setIsOpen(!isOpen)}>
                <span className="icon group-hover:animate-bounce">🎁</span>
                <span>Send Gift</span>
            </button>

            {/* 礼物面板 */}
            {isOpen && (
                <div className="gift-panel">
                    <div className="panel-header">
                        <h4>Select Gift</h4>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
                    </div>

                    {/* 礼物网格 */}
                    <div className="gift-grid">
                        {gifts.map(gift => (
                            <div
                                key={gift.id}
                                className={`gift-item ${selectedGift?.id === gift.id ? 'selected' : ''}`}
                                onClick={() => setSelectedGift(gift)}
                            >
                                <span className="icon">{gift.icon}</span>
                                <span className="name">{gift.name}</span>
                                <span className="price">{gift.price} PTS</span>
                            </div>
                        ))}
                    </div>

                    {/* 留言 */}
                    <div className="input-group">
                        <input
                            type="text"
                            className="message-input"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Add a message..."
                            maxLength={50}
                        />
                    </div>

                    {/* 错误提示 */}
                    {error && <div className="error-msg">⚠️ {error}</div>}

                    {/* 发送按钮 */}
                    <button
                        className="send-btn"
                        onClick={handleSendGift}
                        disabled={loading || !selectedGift}
                    >
                        {loading ? 'SENDING...' : `SEND ${selectedGift?.name ? selectedGift.name.toUpperCase() : ''}`}
                    </button>

                    {/* 余额提示 */}
                    <div className="text-center mt-3 text-[10px] text-text-muted">
                        Balance: <span className="text-accent-cyan font-mono">{balance !== null ? `${balance.toLocaleString()} PTS` : 'Loading...'}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
