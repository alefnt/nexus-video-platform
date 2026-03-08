// FILE: /video-platform/shared/resilience/circuit-breaker.ts
/**
 * 熔断器模块
 * 防止级联故障，提供服务降级能力
 * 
 * 状态:
 *   CLOSED - 正常状态，请求通过
 *   OPEN - 熔断状态，请求直接失败
 *   HALF_OPEN - 半开状态，允许部分请求测试恢复
 */

// ============== 熔断器状态 ==============

export enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN",
}

// ============== 配置接口 ==============

export interface CircuitBreakerOptions {
    name: string;
    failureThreshold?: number;      // 失败阈值 (默认: 5)
    successThreshold?: number;      // 恢复阈值 (默认: 3)
    timeout?: number;               // 熔断超时 ms (默认: 30000)
    resetTimeout?: number;          // 半开超时 ms (默认: 60000)
    monitorInterval?: number;       // 监控间隔 ms (默认: 10000)
    onStateChange?: (from: CircuitState, to: CircuitState) => void;
    onFailure?: (error: Error) => void;
}

// ============== 熔断器统计 ==============

export interface CircuitStats {
    name: string;
    state: CircuitState;
    failures: number;
    successes: number;
    totalRequests: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    openedAt?: number;
}

// ============== 熔断器类 ==============

export class CircuitBreaker {
    private name: string;
    public state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private totalRequests: number = 0;
    private lastFailureTime?: number;
    private lastSuccessTime?: number;
    private openedAt?: number;
    private nextAttempt?: number;

    private readonly failureThreshold: number;
    private readonly successThreshold: number;
    private readonly timeout: number;
    private readonly resetTimeout: number;
    private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
    private readonly onFailure?: (error: Error) => void;

    constructor(options: CircuitBreakerOptions) {
        this.name = options.name;
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 3;
        this.timeout = options.timeout || 30000;
        this.resetTimeout = options.resetTimeout || 60000;
        this.onStateChange = options.onStateChange;
        this.onFailure = options.onFailure;

        console.log(`[CircuitBreaker] Created: ${this.name} (threshold: ${this.failureThreshold})`);
    }

    /**
     * 执行受保护的操作
     */
    async execute<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
        this.totalRequests++;

        // 检查熔断状态
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.transitionTo(CircuitState.HALF_OPEN);
            } else {
                console.warn(`[CircuitBreaker] ${this.name} is OPEN, rejecting request`);
                if (fallback) {
                    return fallback();
                }
                throw new CircuitBreakerOpenError(this.name);
            }
        }

        try {
            const result = await this.executeWithTimeout(fn);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onError(error as Error);

            if (fallback) {
                return fallback();
            }
            throw error;
        }
    }

    /**
     * 带超时执行
     */
    private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`CircuitBreaker ${this.name} timeout`));
            }, this.timeout);

            fn()
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * 成功回调
     */
    private onSuccess(): void {
        this.lastSuccessTime = Date.now();
        this.failureCount = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.transitionTo(CircuitState.CLOSED);
            }
        }
    }

    /**
     * 失败回调
     */
    private onError(error: Error): void {
        this.lastFailureTime = Date.now();
        this.failureCount++;
        this.successCount = 0;

        if (this.onFailure) {
            this.onFailure(error);
        }

        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.OPEN);
        } else if (this.failureCount >= this.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }
    }

    /**
     * 状态转换
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        if (newState === CircuitState.OPEN) {
            this.openedAt = Date.now();
            this.nextAttempt = Date.now() + this.resetTimeout;
        } else if (newState === CircuitState.CLOSED) {
            this.failureCount = 0;
            this.successCount = 0;
            this.openedAt = undefined;
            this.nextAttempt = undefined;
        }

        console.log(`[CircuitBreaker] ${this.name}: ${oldState} -> ${newState}`);

        if (this.onStateChange) {
            this.onStateChange(oldState, newState);
        }
    }

    /**
     * 是否应该尝试恢复
     */
    private shouldAttemptReset(): boolean {
        return this.nextAttempt !== undefined && Date.now() >= this.nextAttempt;
    }

    /**
     * 获取统计信息
     */
    getStats(): CircuitStats {
        return {
            name: this.name,
            state: this.state,
            failures: this.failureCount,
            successes: this.successCount,
            totalRequests: this.totalRequests,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            openedAt: this.openedAt,
        };
    }

    /** Public failure recording for proxy-style usage where execute() isn't viable */
    recordFailure(): void {
        this.onError(new Error("proxy failure"));
    }

    /** Public success recording for proxy-style usage */
    recordSuccess(): void {
        this.onSuccess();
    }

    /**
     * 手动重置
     */
    reset(): void {
        this.transitionTo(CircuitState.CLOSED);
    }

    /**
     * 手动熔断
     */
    trip(): void {
        this.transitionTo(CircuitState.OPEN);
    }
}

// ============== 自定义错误 ==============

export class CircuitBreakerOpenError extends Error {
    constructor(name: string) {
        super(`Circuit breaker ${name} is OPEN`);
        this.name = "CircuitBreakerOpenError";
    }
}

// ============== 熔断器管理器 ==============

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * 获取或创建熔断器
 */
export function getCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
    if (!circuitBreakers.has(options.name)) {
        circuitBreakers.set(options.name, new CircuitBreaker(options));
    }
    return circuitBreakers.get(options.name)!;
}

/**
 * 获取所有熔断器统计
 */
export function getAllCircuitStats(): CircuitStats[] {
    return Array.from(circuitBreakers.values()).map(cb => cb.getStats());
}

/**
 * 重置所有熔断器
 */
export function resetAllCircuitBreakers(): void {
    for (const cb of circuitBreakers.values()) {
        cb.reset();
    }
}

// ============== 装饰器工厂 (用于 API 调用) ==============

/**
 * 创建带熔断保护的函数
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    name: string,
    fn: T,
    fallback?: () => ReturnType<T>
): T {
    const cb = getCircuitBreaker({ name });

    return ((...args: Parameters<T>) => {
        return cb.execute(() => fn(...args), fallback);
    }) as T;
}
