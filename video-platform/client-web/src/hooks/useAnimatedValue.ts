/**
 * useAnimatedValue — 平滑数值动画 Hook
 *
 * 灵感来源：Fitting Pad (artcreativecode.com) 的属性仪表盘
 * 使用 requestAnimationFrame + 指数衰减插值，比 CSS transition 更灵活
 *
 * @param target   - 目标数值
 * @param smoothing - 平滑系数 (0~1)，越大越快到达目标。推荐 0.08~0.2
 * @param precision - 精度阈值，差值小于此值时直接跳到目标值
 * @returns 当前显示数值（每帧平滑过渡）
 *
 * 用法：
 *   const displayBalance = useAnimatedValue(rawBalance, 0.15);
 *   return <span>{displayBalance.toFixed(0)}</span>
 */
import { useRef, useState, useEffect, useCallback } from 'react';

export function useAnimatedValue(
    target: number,
    smoothing = 0.15,
    precision = 0.01,
): number {
    const [display, setDisplay] = useState(target);
    const displayRef = useRef(target);
    const targetRef = useRef(target);
    const rafRef = useRef<number | null>(null);
    const isFirstRef = useRef(true);

    // 第一次渲染时直接跳到目标值，不做动画
    useEffect(() => {
        if (isFirstRef.current) {
            isFirstRef.current = false;
            displayRef.current = target;
            setDisplay(target);
            return;
        }
        targetRef.current = target;
    }, [target]);

    const animate = useCallback(() => {
        const diff = targetRef.current - displayRef.current;

        if (Math.abs(diff) < precision) {
            // 差值足够小，直接到达目标值
            displayRef.current = targetRef.current;
            setDisplay(targetRef.current);
            rafRef.current = null;
            return;
        }

        // 指数衰减插值：display += (target - display) * smoothing
        displayRef.current += diff * smoothing;
        setDisplay(displayRef.current);

        rafRef.current = requestAnimationFrame(animate);
    }, [smoothing, precision]);

    useEffect(() => {
        if (isFirstRef.current) return;

        // 开始动画（如果尚未运行）
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [target, animate]);

    return display;
}

/**
 * useAnimatedValues — 批量平滑数值动画
 *
 * 一次驱动多个数值的动画，共享一个 rAF，性能更优
 *
 * @param targets  - 目标数值对象
 * @param smoothing - 平滑系数
 * @returns 当前显示数值对象
 *
 * 用法：
 *   const display = useAnimatedValues({ viewers: 1234, tips: 5678 }, 0.12);
 *   return <span>{display.viewers.toFixed(0)} viewers</span>
 */
export function useAnimatedValues<T extends Record<string, number>>(
    targets: T,
    smoothing = 0.15,
    precision = 0.01,
): T {
    const [display, setDisplay] = useState<T>({ ...targets });
    const displayRef = useRef<T>({ ...targets });
    const targetRef = useRef<T>({ ...targets });
    const rafRef = useRef<number | null>(null);
    const isFirstRef = useRef(true);

    useEffect(() => {
        if (isFirstRef.current) {
            isFirstRef.current = false;
            displayRef.current = { ...targets };
            setDisplay({ ...targets });
            return;
        }
        targetRef.current = { ...targets };
    }, [JSON.stringify(targets)]);

    const animate = useCallback(() => {
        const cur = displayRef.current;
        const tgt = targetRef.current;
        let maxDiff = 0;

        const next = { ...cur };
        for (const key of Object.keys(tgt) as (keyof T)[]) {
            const diff = (tgt[key] as number) - (cur[key] as number);
            if (Math.abs(diff) < precision) {
                (next as any)[key] = tgt[key];
            } else {
                (next as any)[key] = (cur[key] as number) + diff * smoothing;
                maxDiff = Math.max(maxDiff, Math.abs(diff));
            }
        }

        displayRef.current = next as T;
        setDisplay({ ...next } as T);

        if (maxDiff < precision) {
            rafRef.current = null;
            return;
        }

        rafRef.current = requestAnimationFrame(animate);
    }, [smoothing, precision]);

    useEffect(() => {
        if (isFirstRef.current) return;
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(animate);
        }
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [JSON.stringify(targets), animate]);

    return display;
}

export default useAnimatedValue;
