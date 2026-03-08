// FILE: /video-platform/client-web/src/components/PaymentOverlay.tsx
/**
 * Nexus Video - 付费解锁覆盖层 (Dual Mode Enhanced)
 * 
 * 支持两种支付模式：
 * 1. 一次性买断 (Points) - 支持流支付抵扣
 * 2. 流支付 (Fiber Stream Pay)
 */

import React, { useState, useEffect } from "react";
import { getApiClient } from "../lib/apiClient";

const client = getApiClient();

interface StreamHistory {
  hasPaidSegments: boolean;
  paidSegments: number[];
  totalPaid: number;
  discountAmount: number;
}

interface PaymentOverlayProps {
  videoId?: string; // 新增：视频ID，用于查询流支付历史
  buyOncePrice?: number; // 积分买断价格
  streamPricePerMinute?: number; // 流支付价格
  priceMode?: 'free' | 'buy_once' | 'stream' | 'both';
  onBuyOnce?: (finalPrice: number) => Promise<void>;
  onStartStream?: () => Promise<void>;
  onTopUp?: () => void;
  previewSeconds?: number;
  onPreview?: () => void;
  isProcessing?: boolean;
  // Custom Labels for Music/Article Adaptation
  labels?: {
    streamTitle?: string;     // e.g. "按需付费 (Fiber 流支付)"
    streamUnit?: string;      // e.g. "分钟" or "章节"
    streamDesc?: string;      // e.g. "看多少付多少" or "解锁本章节"
    buyOnceTitle?: string;    // e.g. "永久买断"
  };
}

export function PaymentOverlay({
  videoId,
  buyOncePrice,
  streamPricePerMinute,
  priceMode = 'buy_once',
  onBuyOnce,
  onStartStream,
  onTopUp,
  previewSeconds = 0,
  onPreview,
  isProcessing = false,
  labels = {}
}: PaymentOverlayProps) {
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [streamHistory, setStreamHistory] = useState<StreamHistory | null>(null);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'buyOnce' | 'stream' | null>(null);

  // Defaults
  const txt_StreamTitle = labels.streamTitle || "按需付费 (Fiber 流支付)";
  const txt_StreamUnit = labels.streamUnit || "分钟";
  const txt_StreamDesc = labels.streamDesc || "看多少付多少，随时可停";
  const txt_BuyOnceTitle = labels.buyOnceTitle || "永久买断";

  // 使用默认价格确保不显示 undefined
  const effectiveBuyOncePrice = buyOncePrice ?? 1000;
  const effectiveStreamPrice = streamPricePerMinute ?? 10;

  // 计算抵扣后的价格
  const discountAmount = streamHistory?.discountAmount || 0;
  const finalPrice = Math.max(0, effectiveBuyOncePrice - discountAmount);
  const hasDiscount = discountAmount > 0;

  // ... (useEffect kept same)
  // 获取余额和流支付历史
  useEffect(() => {
    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    if (jwt) client.setJWT(jwt);

    // 获取余额
    client.get<{ balance: number }>("/payment/points/balance")
      .then(res => {
        const val = res?.balance ?? Number((res as any)?.points ?? 0);
        setBalance(isNaN(val) ? 0 : val);
        setLoadingBalance(false);
      })
      .catch(() => {
        setBalance(null);
        setLoadingBalance(false);
      });

    // 获取流支付历史
    if (videoId) {
      client.get<StreamHistory>(`/payment/stream/history/${videoId}`)
        .then(res => {
          if (res?.hasPaidSegments) {
            setStreamHistory(res);
          }
        })
        .catch(() => { /* ignore */ });
    }
  }, [videoId]);

  const insufficientBalance = balance !== null && finalPrice > 0 && balance < finalPrice;

  // ... Handlers (BuyOnce, StartStream) kept same ...
  const handleBuyOnce = async () => {
    if (!onBuyOnce) return;
    setError(null);
    if (balance !== null && balance < finalPrice) {
      setPendingAction('buyOnce');
      setShowInsufficientModal(true);
      return;
    }
    try {
      await onBuyOnce(finalPrice);
    } catch (e: any) {
      setError(e?.message || "支付失败，请重试");
    }
  };

  const handleStartStream = async () => {
    if (!onStartStream) return;
    setError(null);
    const minRequired = streamPricePerMinute || 1;
    if (balance !== null && balance < minRequired) {
      setPendingAction('stream');
      setShowInsufficientModal(true);
      return;
    }
    try {
      await onStartStream();
    } catch (e: any) {
      setError(e?.message || "启动流支付失败");
    }
  };

  const handleInsufficientConfirm = (goToTopUp: boolean) => {
    setShowInsufficientModal(false);
    if (goToTopUp && onTopUp) {
      onTopUp();
    }
    setPendingAction(null);
  };

  return (
    <div className="payment-overlay">
      <div className="payment-content">
        <div className="lock-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 className="title">Premium Content</h2>
        <p className="subtitle">选择支付方式解锁观看</p>

        {/* 余额显示 */}
        {balance !== null && (
          <div className="balance-display" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", marginBottom: 20, borderRadius: 8,
            background: insufficientBalance ? "rgba(255, 107, 157, 0.1)" : "rgba(255, 217, 61, 0.1)",
            border: `1px solid ${insufficientBalance ? "rgba(255, 107, 157, 0.3)" : "rgba(255, 217, 61, 0.3)"}`
          }}>
            <span style={{ color: "var(--text-muted)" }}>当前余额</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: insufficientBalance ? "#FF6B9D" : "var(--accent-yellow)" }}>
                {loadingBalance ? "..." : `${balance} PTS`}
              </span>
              {onTopUp && (
                <button
                  onClick={onTopUp}
                  style={{
                    padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: "var(--accent-cyan)", color: "#000", border: "none", cursor: "pointer"
                  }}
                >充值</button>
              )}
            </div>
          </div>
        )}

        {error && <div className="error-msg">{error}</div>}

        <div className="payment-options">
          {/* Option 1: Buy Once */}
          {(priceMode === 'buy_once' || priceMode === 'both') && (
            <div className="pay-card" onClick={handleBuyOnce} style={{ cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
              <div className="pay-icon">💎</div>
              <div className="pay-info">
                <div className="pay-title">{txt_BuyOnceTitle}</div>
                {hasDiscount ? (
                  <div className="pay-price">
                    <span style={{ textDecoration: "line-through", color: "rgba(255,255,255,0.4)", marginRight: 8 }}>
                      {effectiveBuyOncePrice} PTS
                    </span>
                    <span style={{ color: "var(--accent-green)" }}>{finalPrice} PTS</span>
                    <span style={{ fontSize: 11, color: "var(--accent-green)", marginLeft: 8 }}>
                      已抵扣 {discountAmount}
                    </span>
                  </div>
                ) : (
                  <div className="pay-price">{effectiveBuyOncePrice} PTS</div>
                )}
              </div>
              <button className="pay-btn" disabled={isProcessing} onClick={(e) => { e.stopPropagation(); handleBuyOnce(); }}>
                {isProcessing ? "..." : "购买"}
              </button>
            </div>
          )}

          {/* Option 2: Stream Pay */}
          {(priceMode === 'stream' || priceMode === 'both') && (
            <div className="pay-card stream-card" onClick={handleStartStream} style={{ cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
              <div className="pay-icon">⚡</div>
              <div className="pay-info">
                <div className="pay-title">{txt_StreamTitle}</div>
                <div className="pay-price">{effectiveStreamPrice} PTS/{txt_StreamUnit}</div>
                <div className="pay-desc" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {txt_StreamDesc}
                </div>
              </div>
              <button className="pay-btn stream-btn" disabled={isProcessing} onClick={(e) => { e.stopPropagation(); handleStartStream(); }}>
                {isProcessing ? "..." : "开始"}
              </button>
            </div>
          )}

          {/* Stream Explanation */}
          {(priceMode === 'stream' || priceMode === 'both') && (
            <div className="stream-explanation" style={{
              marginTop: 16, padding: 16, borderRadius: 12,
              background: "rgba(0, 255, 255, 0.05)",
              border: "1px solid rgba(0, 255, 255, 0.15)",
              textAlign: "left", fontSize: 12
            }}>
              <div style={{ fontWeight: 700, color: "var(--accent-cyan)", marginBottom: 8 }}>
                💡 流支付说明 (Fiber Network)
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text-muted)", lineHeight: 1.8 }}>
                {labels.streamUnit === '章节' ? (
                  <>
                    <li>文章按章节解锁 (Reading Units)</li>
                    <li>开始阅读即自动从小额扣款</li>
                  </>
                ) : (
                  <>
                    <li>视频/音频按时间分段 (每 5-15 分钟一段)</li>
                    <li>每段开始时支付，通过 Fiber 通道结算</li>
                  </>
                )}
                <li>结算货币: <b style={{ color: "var(--accent-yellow)" }}>CKB / USDI</b></li>
                <li>随时可暂停/停止</li>
              </ul>
            </div>
          )}
        </div>

        {/* 试看按钮 */}
        {onPreview && previewSeconds > 0 && (
          <button className="preview-button" onClick={onPreview}>
            ▶️ 试看前 {previewSeconds} 秒
          </button>
        )}

        <p className="security-note">
          <span className="secure-icon">🔒</span>
          Secured by CKB & Fiber Network
        </p>
      </div>

      {/* 余额不足确认弹窗 */}
      {showInsufficientModal && (
        <div className="insufficient-modal-overlay">
          <div className="insufficient-modal">
            <div className="modal-icon">💫</div>
            <h3 className="modal-title">积分余额不足</h3>
            <p className="modal-desc">
              当前余额: <span className="highlight">{balance ?? 0}</span> 积分<br />
              {pendingAction === 'buyOnce' ? (
                <>需要: <span className="highlight">{finalPrice}</span> 积分</>
              ) : (
                <>流支付至少需要: <span className="highlight">{streamPricePerMinute || 1}</span> 积分/分钟</>
              )}
            </p>
            <p className="modal-question">是否前往积分中心充值？</p>
            <div className="modal-buttons">
              <button
                className="modal-btn confirm-btn"
                onClick={() => handleInsufficientConfirm(true)}
              >
                去充值
              </button>
              <button
                className="modal-btn cancel-btn"
                onClick={() => handleInsufficientConfirm(false)}
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .payment-overlay {
          position: fixed; inset: 0;
          background: rgba(10, 10, 20, 0.98);
          backdrop-filter: blur(30px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .payment-content { text-align: center; max-width: 420px; width: 100%; padding: 20px; }
        .lock-icon { margin-bottom: 16px; animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

        .title { margin: 0 0 8px; font-size: 24px; font-weight: 800; color: #fff; }
        .subtitle { margin: 0 0 24px; color: var(--text-muted); font-size: 14px; }
        
        .error-msg {
          background: rgba(255, 107, 157, 0.15);
          border: 1px solid rgba(255, 107, 157, 0.3);
          color: var(--accent-pink); padding: 10px; border-radius: 8px;
          margin-bottom: 20px; font-size: 13px;
        }

        .payment-options { display: flex; flex-direction: column; gap: 12px; }

        .pay-card {
            display: flex; align-items: center; gap: 16px;
            padding: 16px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; cursor: pointer;
            transition: all 0.2s;
        }
        .pay-card:hover {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.2);
            transform: translateY(-2px);
        }
        .stream-card {
            border-color: rgba(0, 255, 255, 0.3);
            background: rgba(0, 255, 255, 0.05);
        }
        .stream-card:hover {
             background: rgba(0, 255, 255, 0.1);
             box-shadow: 0 0 15px rgba(0,255,255,0.2);
        }

        .pay-icon { font-size: 24px; }
        .pay-info { flex: 1; text-align: left; }
        .pay-title { font-weight: 700; color: #fff; font-size: 15px; }
        .pay-price { color: var(--accent-cyan); font-size: 13px; font-family: monospace; }
        
        .pay-btn {
            padding: 8px 16px; border-radius: 8px; border: none;
            background: linear-gradient(135deg, #a267ff, #6c5ce7); color: #fff;
            font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .pay-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(162, 103, 255, 0.4);
        }
        .stream-btn {
            background: var(--accent-cyan); color: #000;
        }

        .preview-button {
          display: block; width: 100%; margin-top: 20px; padding: 12px;
          background: transparent; border: 1px solid var(--border-subtle);
          border-radius: 8px; color: var(--text-secondary); cursor: pointer;
        }
        .preview-button:hover { background: rgba(255,255,255,0.05); color: #fff; }

        .security-note { margin-top: 24px; font-size: 12px; color: var(--text-muted); opacity: 0.7; }

        /* 余额不足弹窗样式 */
        .insufficient-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex; align-items: center; justify-content: center;
          z-index: 10001; animation: fadeIn 0.2s ease;
        }
        .insufficient-modal {
          background: linear-gradient(135deg, rgba(30, 30, 45, 0.98), rgba(20, 20, 30, 0.98));
          border: 1px solid rgba(162, 103, 255, 0.4);
          border-radius: 20px; padding: 32px; max-width: 360px; text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        }
        .modal-icon { font-size: 48px; margin-bottom: 16px; }
        .modal-title { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 16px; }
        .modal-desc { font-size: 14px; color: var(--text-muted); margin: 0 0 12px; line-height: 1.6; }
        .modal-desc .highlight { color: var(--accent-pink); font-weight: 700; }
        .modal-question { font-size: 15px; color: #fff; margin: 0 0 24px; font-weight: 600; }
        .modal-buttons { display: flex; gap: 12px; }
        .modal-btn {
          flex: 1; padding: 14px 20px; border-radius: 12px; border: none;
          font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .confirm-btn {
          background: linear-gradient(135deg, #a267ff, #6c5ce7); color: #fff;
        }
        .confirm-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(162, 103, 255, 0.4); }
        .cancel-btn {
          background: rgba(255, 255, 255, 0.05); color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }
        .cancel-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      `}</style>
    </div>
  );
}

export default PaymentOverlay;
