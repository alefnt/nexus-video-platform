// FILE: /video-platform/client-web/src/components/Toast.tsx
/**
 * Nexus Video - 统一 Toast 通知组件
 * 
 * 功能：
 * - 支持 success/error/warning/info 类型
 * - 自动消失 + 手动关闭
 * - 堆叠显示多条通知
 * - 动画进入/退出
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// Toast 类型定义
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// 生成唯一 ID
const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Toast Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = generateId();
        const newToast: Toast = {
            ...toast,
            id,
            duration: toast.duration ?? 4000,
        };
        setToasts(prev => [...prev, newToast]);

        // 自动移除
        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => removeToast(id), newToast.duration);
        }
    }, [removeToast]);

    const success = useCallback((title: string, message?: string) => {
        addToast({ type: 'success', title, message });
    }, [addToast]);

    const error = useCallback((title: string, message?: string) => {
        addToast({ type: 'error', title, message, duration: 6000 });
    }, [addToast]);

    const warning = useCallback((title: string, message?: string) => {
        addToast({ type: 'warning', title, message });
    }, [addToast]);

    const info = useCallback((title: string, message?: string) => {
        addToast({ type: 'info', title, message });
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

// Hook 使用 Toast
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// Toast 图标
function ToastIcon({ type }: { type: ToastType }) {
    const iconProps = { size: 20, strokeWidth: 2 };

    switch (type) {
        case 'success':
            return <CheckCircle {...iconProps} color="var(--status-success)" />;
        case 'error':
            return <XCircle {...iconProps} color="var(--status-error)" />;
        case 'warning':
            return <AlertTriangle {...iconProps} color="var(--status-warning)" />;
        case 'info':
            return <Info {...iconProps} color="var(--status-info)" />;
    }
}

// 单个 Toast 组件
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    const [isExiting, setIsExiting] = useState(false);

    const handleRemove = () => {
        setIsExiting(true);
        setTimeout(onRemove, 200);
    };

    return (
        <div
            className={`toast toast-${toast.type}`}
            style={{
                opacity: isExiting ? 0 : 1,
                transform: isExiting ? 'translateX(20px)' : 'translateX(0)',
                transition: 'all 0.2s ease-out',
            }}
        >
            <div className="toast-icon">
                <ToastIcon type={toast.type} />
            </div>
            <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button className="toast-close" onClick={handleRemove}>
                <X size={16} />
            </button>
        </div>
    );
}

// Toast 容器
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map((toast, index) => (
                <div
                    key={toast.id}
                    style={{
                        animationDelay: `${index * 50}ms`,
                    }}
                >
                    <ToastItem toast={toast} onRemove={() => onRemove(toast.id)} />
                </div>
            ))}
        </div>
    );
}

export default ToastProvider;
