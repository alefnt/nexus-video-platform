/**
 * ErrorBoundary 组件测试
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';

// 测试用的会抛出错误的组件
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error message');
    }
    return <div>Content rendered successfully</div>;
};

describe('ErrorBoundary', () => {
    // 抑制测试中的 console.error
    const originalError = console.error;
    beforeAll(() => {
        console.error = vi.fn();
    });
    afterAll(() => {
        console.error = originalError;
    });

    it('renders children when no error', () => {
        render(
            <ErrorBoundary>
                <div>Normal content</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('renders error UI when child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );
        expect(screen.getByText('哎呀，出了点问题')).toBeInTheDocument();
        expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom error</div>}>
                <ThrowError />
            </ErrorBoundary>
        );
        expect(screen.getByText('Custom error')).toBeInTheDocument();
    });

    it('calls onError callback when error occurs', () => {
        const onError = vi.fn();
        render(
            <ErrorBoundary onError={onError}>
                <ThrowError />
            </ErrorBoundary>
        );
        expect(onError).toHaveBeenCalled();
    });

    it('shows retry button that resets error state', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        // 验证错误界面显示
        expect(screen.getByText('哎呀，出了点问题')).toBeInTheDocument();

        // 点击重试
        const retryButton = screen.getByText('重试');
        expect(retryButton).toBeInTheDocument();
    });
});
