/**
 * ConfirmModal — Promise-based reusable confirm/alert modal
 *
 * Usage:
 *   const ok = await showConfirm({ title: '确认支付', message: '将扣除 100 积分' });
 *   if (ok) { ... }
 *
 *   await showAlert({ title: '提示', message: '操作成功' });
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// ─── Types ───────────────────────────────────────────────────────

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    /** 'confirm' shows confirm+cancel, 'alert' shows only one button */
    mode?: 'confirm' | 'alert';
    /** Visual variant */
    variant?: 'default' | 'warning' | 'danger' | 'success';
}

// ─── Internal Component ──────────────────────────────────────────

const ConfirmModalInner: React.FC<
    ConfirmOptions & { onResolve: (result: boolean) => void }
> = ({ title, message, confirmText, cancelText, mode = 'confirm', variant = 'default', onResolve }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const close = useCallback((result: boolean) => {
        setVisible(false);
        setTimeout(() => onResolve(result), 200);
    }, [onResolve]);

    // Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [close]);

    const accentColor: Record<string, string> = {
        default: '#8b5cf6',
        warning: '#f59e0b',
        danger: '#ef4444',
        success: '#22c55e',
    };

    const color = accentColor[variant] || accentColor.default;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
                backdropFilter: visible ? 'blur(8px)' : 'blur(0)',
                transition: 'all 0.2s ease',
            }}
            onClick={() => close(false)}
        >
            <div
                style={{
                    background: 'rgba(15, 15, 25, 0.95)',
                    border: `1px solid ${color}40`,
                    borderRadius: 16,
                    padding: '28px 32px',
                    maxWidth: 420,
                    width: '90%',
                    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
                    opacity: visible ? 1 : 0,
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: `0 0 40px ${color}15, 0 20px 60px rgba(0,0,0,0.5)`,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Title */}
                <h3
                    style={{
                        margin: '0 0 12px',
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#fff',
                    }}
                >
                    {title}
                </h3>

                {/* Message */}
                <p
                    style={{
                        margin: '0 0 24px',
                        fontSize: 14,
                        lineHeight: 1.7,
                        color: 'rgba(255,255,255,0.65)',
                        whiteSpace: 'pre-line',
                    }}
                >
                    {message}
                </p>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    {mode === 'confirm' && (
                        <button
                            onClick={() => close(false)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(255,255,255,0.06)',
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                        >
                            {cancelText || '取消'}
                        </button>
                    )}
                    <button
                        onClick={() => close(true)}
                        autoFocus
                        style={{
                            padding: '10px 24px',
                            borderRadius: 10,
                            border: 'none',
                            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: `0 0 20px ${color}30`,
                            transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = `0 0 30px ${color}50`;
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = `0 0 20px ${color}30`;
                        }}
                    >
                        {confirmText || (mode === 'alert' ? '确定' : '确认')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Show a confirm dialog. Returns a promise that resolves to true (confirm) or false (cancel).
 */
export function showConfirm(options: Omit<ConfirmOptions, 'mode'>): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const container = document.createElement('div');
        container.id = `confirm-modal-${Date.now()}`;
        document.body.appendChild(container);

        const root = createRoot(container);

        const handleResolve = (result: boolean) => {
            root.unmount();
            container.remove();
            resolve(result);
        };

        root.render(
            <ConfirmModalInner {...options} mode="confirm" onResolve={handleResolve} />
        );
    });
}

/**
 * Show an alert dialog. Returns a promise that resolves when dismissed.
 */
export function showAlert(options: Omit<ConfirmOptions, 'mode' | 'cancelText'>): Promise<void> {
    return showConfirm({ ...options, mode: 'alert' } as any).then(() => { });
}

export default ConfirmModalInner;
