/**
 * ErrorBoundary - 全局错误边界组件
 * 
 * 功能：
 * - 捕获子组件渲染错误
 * - 显示友好的错误界面
 * - 支持重试功能
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0A0A10 0%, #1a1a2e 100%)',
                    color: '#fff',
                    padding: 40,
                    textAlign: 'center',
                }}>
                    <div style={{
                        fontSize: 64,
                        marginBottom: 20,
                        animation: 'pulse 2s infinite',
                    }}>
                        ⚠️
                    </div>
                    <h1 style={{
                        fontSize: 28,
                        fontWeight: 700,
                        marginBottom: 16,
                        background: 'linear-gradient(90deg, #A267FF, #00F5D4)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        哎呀，出了点问题
                    </h1>
                    <p style={{
                        fontSize: 16,
                        color: 'rgba(255,255,255,0.6)',
                        maxWidth: 400,
                        marginBottom: 24,
                        lineHeight: 1.6,
                    }}>
                        {this.state.error?.message || '发生了未知错误，请尝试刷新页面'}
                    </p>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button
                            onClick={this.handleRetry}
                            style={{
                                padding: '12px 32px',
                                fontSize: 16,
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #A267FF, #00D9FF)',
                                border: 'none',
                                borderRadius: 100,
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                            }}
                        >
                            重试
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{
                                padding: '12px 32px',
                                fontSize: 16,
                                fontWeight: 600,
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 100,
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                            }}
                        >
                            返回首页
                        </button>
                    </div>
                    <style>{`
                        @keyframes pulse {
                            0%, 100% { opacity: 1; transform: scale(1); }
                            50% { opacity: 0.8; transform: scale(1.05); }
                        }
                    `}</style>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

// Route-level error boundary for React Router errorElement
import { useRouteError, useNavigate } from 'react-router-dom';

export function RouteErrorBoundary() {
    const error = useRouteError() as any;
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            justifyContent: 'center',
            background: '#030308',
            color: '#fff',
            padding: 40,
            textAlign: 'center' as const,
        }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⚠️</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16, color: '#22d3ee' }}>
                Page Error
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 400, marginBottom: 24 }}>
                {error?.message || error?.statusText || 'An unexpected error occurred.'}
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        padding: '10px 24px', background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 100,
                        color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    }}
                >
                    Go Back
                </button>
                <button
                    onClick={() => navigate('/home')}
                    style={{
                        padding: '10px 24px', background: 'linear-gradient(135deg, #22d3ee, #a855f7)',
                        border: 'none', borderRadius: 100,
                        color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    }}
                >
                    Home
                </button>
            </div>
        </div>
    );
}
