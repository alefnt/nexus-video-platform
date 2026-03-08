/**
 * 全局 API 错误 Toast 组件
 * 
 * 承接 useUIStore 的 toasts 队列，在页面右上角显示全局错误/成功提示。
 * 监听 api:serverError（5xx）并展示 Toast。
 */

import React, { useEffect } from 'react';
import { useUIStore } from '../stores';

const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
    success: { bg: 'bg-green-900/90', border: 'border-green-500', icon: '✅' },
    error: { bg: 'bg-red-900/90', border: 'border-red-500', icon: '❌' },
    warning: { bg: 'bg-yellow-900/90', border: 'border-yellow-500', icon: '⚠️' },
    info: { bg: 'bg-blue-900/90', border: 'border-blue-500', icon: 'ℹ️' },
};

export function GlobalToast() {
    const toasts = useUIStore((s) => s.toasts);
    const removeToast = useUIStore((s) => s.removeToast);
    const addToast = useUIStore((s) => s.addToast);

    useEffect(() => {
        const handler = (e: Event) => {
            const { message } = (e as CustomEvent<{ message?: string; status?: number }>).detail || {};
            addToast('error', message || '服务暂时不可用，请稍后重试', 5000);
        };
        window.addEventListener('api:serverError', handler);
        return () => window.removeEventListener('api:serverError', handler);
    }, [addToast]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => {
                const style = typeStyles[toast.type] || typeStyles.info;
                return (
                    <div
                        key={toast.id}
                        className={`${style.bg} ${style.border} border rounded-lg p-3 shadow-2xl backdrop-blur-sm animate-fade-in flex items-start gap-2`}
                    >
                        <span className="text-sm flex-shrink-0">{style.icon}</span>
                        <p className="text-white text-sm flex-1">{toast.message}</p>
                        <button
                            className="text-gray-400 hover:text-white text-xs ml-2 flex-shrink-0"
                            onClick={() => removeToast(toast.id)}
                        >
                            ✕
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export default GlobalToast;
