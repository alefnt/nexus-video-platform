// FILE: /client-web/src/components/PaymentModal.tsx
/**
 * 支付弹窗组件 — 积分 + CKB 双模式
 * 支持: resume / segment / convert / seek / ckb
 * 当积分不足时, 显示 CKB 充值入口
 */

import React, { useEffect, useState } from 'react';
import '../styles/PaymentModal.css';
import JoyIdGuide from './JoyIdGuide';

export interface PaymentModalProps {
    isOpen: boolean;
    type: 'resume' | 'segment' | 'convert' | 'seek' | 'ckb' | 'stream-start';
    title?: string;
    message?: string;
    // 续看相关
    paidSegments?: number[];
    totalSegments?: number;
    resumeFromSegment?: number;
    segmentMinutes?: number;
    // 支付相关
    amount?: number;
    currentBalance?: number;
    // 全量购买抵扣
    originalPrice?: number;
    discountAmount?: number;
    finalPrice?: number;
    // CKB 直付
    ckbAmount?: number;
    creatorAddress?: string;
    // 回调
    onConfirm: () => void;
    onCancel: () => void;
    /** 积分不足时切换到 CKB 支付 */
    onSwitchToCkb?: () => void;
    // Per-second stream info
    videoDuration?: number;
    pricePerSecond?: number;
    segmentSeconds?: number;
    estimatedTotal?: number;
}

export default function PaymentModal({
    isOpen,
    type,
    title,
    message,
    paidSegments = [],
    totalSegments = 0,
    resumeFromSegment = 1,
    segmentMinutes = 5,
    amount = 0,
    currentBalance,
    originalPrice,
    discountAmount,
    finalPrice,
    ckbAmount,
    creatorAddress,
    onConfirm,
    onCancel,
    onSwitchToCkb,
    videoDuration = 0,
    pricePerSecond = 0,
    segmentSeconds: segmentSecondsProp = 300,
    estimatedTotal = 0,
}: PaymentModalProps) {
    const [visible, setVisible] = useState(false);
    const [animating, setAnimating] = useState(false);
    const [showJoyIdGuide, setShowJoyIdGuide] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            setTimeout(() => setAnimating(true), 10);
        } else {
            setAnimating(false);
            setTimeout(() => setVisible(false), 300);
        }
    }, [isOpen]);

    if (!visible) return null;

    const insufficientPoints = currentBalance !== undefined && amount > 0 && currentBalance < amount;

    const renderContent = () => {
        switch (type) {
            case 'resume':
                return (
                    <>
                        <div className="pm-icon pm-icon-resume">📺</div>
                        <h2 className="pm-title">{title || '检测到观看记录'}</h2>
                        <div className="pm-info-box">
                            <div className="pm-info-row">
                                <span className="pm-label">已支付段落</span>
                                <span className="pm-value pm-highlight">
                                    第 {paidSegments.join(', ')} 段 (共 {totalSegments} 段)
                                </span>
                            </div>
                            <div className="pm-info-row">
                                <span className="pm-label">可从以下位置继续</span>
                                <span className="pm-value">
                                    {Math.floor((resumeFromSegment - 1) * segmentMinutes)} 分 0 秒
                                </span>
                            </div>
                        </div>
                        <p className="pm-message">
                            <span className="pm-badge pm-badge-success">✓ 已付费段落无需重复付费</span>
                        </p>
                    </>
                );

            case 'segment':
            case 'stream-start': {
                const totalMin = Math.floor(videoDuration / 60);
                const totalSec = videoDuration % 60;
                const segsCount = totalSegments || Math.ceil(videoDuration / segmentSecondsProp);
                const segMin = Math.floor(segmentSecondsProp / 60);
                const segSec = segmentSecondsProp % 60;
                const segCost = Math.ceil(pricePerSecond * segmentSecondsProp * 100) / 100;
                const estTotal = estimatedTotal || Math.ceil(pricePerSecond * videoDuration);
                const isStreamStart = type === 'stream-start';

                return (
                    <>
                        <div className="pm-icon pm-icon-segment">⚡</div>
                        <h2 className="pm-title">{title || (isStreamStart ? 'Stream Pay — 按秒计费' : '继续观看')}</h2>

                        {/* Per-second billing explanation */}
                        {isStreamStart && (
                            <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, background: 'rgba(46, 213, 115, 0.1)', border: '1px solid rgba(46, 213, 115, 0.3)', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                                按观看时间实时计费，随时停止只需支付已看部分
                            </div>
                        )}

                        <div className="pm-info-box">
                            <div className="pm-info-row">
                                <span className="pm-label">总时长</span>
                                <span className="pm-value">{totalMin}分{totalSec > 0 ? `${totalSec}秒` : ''}</span>
                            </div>
                            <div className="pm-info-row">
                                <span className="pm-label">分段展示</span>
                                <span className="pm-value">{segsCount} 段 × {segMin > 0 ? `${segMin}分` : ''}{segSec > 0 ? `${segSec}秒` : ''}</span>
                            </div>
                            <div className="pm-info-row">
                                <span className="pm-label">计费单价</span>
                                <span className="pm-value">{pricePerSecond.toFixed(4)} PTS/秒</span>
                            </div>
                            <div className="pm-info-row">
                                <span className="pm-label">每段预估</span>
                                <span className="pm-value">≈ {segCost.toFixed(2)} PTS</span>
                            </div>
                            <div className="pm-info-row pm-info-row-highlight">
                                <span className="pm-label">看完预估</span>
                                <span className="pm-value pm-price">{estTotal} PTS</span>
                            </div>
                        </div>

                        {isStreamStart && (
                            <p className="pm-message">
                                <span className="pm-badge pm-badge-info">💡 分段仅为展示标记，不是付费节点</span>
                            </p>
                        )}

                        {currentBalance !== undefined && (
                            <p className="pm-balance">
                                当前余额: <span className={currentBalance >= estTotal ? 'pm-balance-ok' : 'pm-balance-low'}>
                                    {currentBalance} PTS
                                </span>
                            </p>
                        )}
                        {insufficientPoints && onSwitchToCkb && (
                            <button className="pm-btn pm-btn-ckb" onClick={onSwitchToCkb}>
                                ⛓ 余额不足？用 CKB 充值
                            </button>
                        )}
                    </>
                );
            }

            case 'seek':
                return (
                    <>
                        <div className="pm-icon pm-icon-seek">🔒</div>
                        <h2 className="pm-title">{title || '该段落尚未购买'}</h2>
                        <div className="pm-info-box">
                            <div className="pm-info-row">
                                <span className="pm-label">跳转目标</span>
                                <span className="pm-value">第 {resumeFromSegment} 段</span>
                            </div>
                            <div className="pm-info-row pm-info-row-highlight">
                                <span className="pm-label">需支付</span>
                                <span className="pm-value pm-price">{amount} 积分</span>
                            </div>
                        </div>
                        <p className="pm-message">
                            点击"支付"解锁此段落，或"返回"回到已付费区域
                        </p>
                        {insufficientPoints && onSwitchToCkb && (
                            <button className="pm-btn pm-btn-ckb" onClick={onSwitchToCkb}>
                                ⛓ 积分不足？用 CKB 支付
                            </button>
                        )}
                    </>
                );

            case 'convert':
                return (
                    <>
                        <div className="pm-icon pm-icon-convert">💎</div>
                        <h2 className="pm-title">{title || '升级为永久买断'}</h2>
                        <div className="pm-info-box">
                            <div className="pm-info-row">
                                <span className="pm-label">视频原价</span>
                                <span className="pm-value pm-strikethrough">{originalPrice} 积分</span>
                            </div>
                            <div className="pm-info-row">
                                <span className="pm-label">已付流支付</span>
                                <span className="pm-value pm-discount">- {discountAmount} 积分</span>
                            </div>
                            <div className="pm-divider"></div>
                            <div className="pm-info-row pm-info-row-highlight">
                                <span className="pm-label">实付金额</span>
                                <span className="pm-value pm-final-price">{finalPrice} 积分</span>
                            </div>
                        </div>
                        <p className="pm-message">
                            <span className="pm-badge pm-badge-info">💡 升级后可永久观看完整视频</span>
                        </p>
                    </>
                );

            case 'ckb':
                return (
                    <>
                        <div className="pm-icon pm-icon-segment">⛓</div>
                        <h2 className="pm-title">{title || 'CKB 链上支付'}</h2>
                        <div className="pm-info-box">
                            <div className="pm-info-row pm-info-row-highlight">
                                <span className="pm-label">支付金额</span>
                                <span className="pm-value pm-price">{ckbAmount || amount} CKB</span>
                            </div>
                            {creatorAddress && (
                                <div className="pm-info-row">
                                    <span className="pm-label">收款地址</span>
                                    <span className="pm-value" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                                        {creatorAddress.slice(0, 20)}...{creatorAddress.slice(-10)}
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="pm-message">
                            <span className="pm-badge pm-badge-info">🔐 将通过 JoyID / CCC 钱包签名确认</span>
                        </p>
                    </>
                );

            default:
                return <p className="pm-message">{message}</p>;
        }
    };

    return (
        <>
            <div className={`pm-overlay ${animating ? 'pm-overlay-visible' : ''}`} onClick={onCancel}>
                <div className={`pm-container ${animating ? 'pm-container-visible' : ''}`} onClick={e => e.stopPropagation()}>
                    {renderContent()}
                    <div className="pm-actions">
                        <button className="pm-btn pm-btn-cancel" onClick={onCancel}>
                            {type === 'seek' ? '返回' : '取消'}
                        </button>
                        <button className="pm-btn pm-btn-confirm" onClick={onConfirm}>
                            {type === 'resume' ? '继续观看'
                                : type === 'convert' ? '立即升级'
                                    : type === 'ckb' ? '🔐 确认签名'
                                        : type === 'stream-start' ? '▶ 开始观看'
                                            : '支付'}
                        </button>
                    </div>
                </div>
            </div>

            <JoyIdGuide
                visible={showJoyIdGuide}
                onClose={() => setShowJoyIdGuide(false)}
                reason="CKB 支付需要连接 JoyID 钱包来签名交易"
            />
        </>
    );
}

// Promise-based helper for use in async contexts
export function showPaymentModal(props: Omit<PaymentModalProps, 'isOpen' | 'onConfirm' | 'onCancel'>): Promise<boolean> {
    return new Promise((resolve) => {
        const container = document.createElement('div');
        container.id = 'payment-modal-root';
        document.body.appendChild(container);

        const cleanup = () => {
            container.remove();
        };

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        // Dynamic import to avoid SSR issues
        import('react-dom/client').then(({ createRoot }) => {
            const root = createRoot(container);
            root.render(
                <PaymentModal
                    {...props}
                    isOpen={true}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            );
        });
    });
}
