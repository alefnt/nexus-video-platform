/**
 * 🔊 useSound Hook
 * React Hook for sound effects integration
 */

import { useCallback, useSyncExternalStore } from 'react';
import { soundEffects, SoundType } from '../lib/soundEffects';

// 用于 useSyncExternalStore 的订阅
let listeners: (() => void)[] = [];

function subscribe(listener: () => void) {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
}

function notifyListeners() {
    listeners.forEach(l => l());
}

// 包装原始方法以触发更新
const originalSetEnabled = soundEffects.setEnabled.bind(soundEffects);
soundEffects.setEnabled = (enabled: boolean) => {
    originalSetEnabled(enabled);
    notifyListeners();
};

const originalSetVolume = soundEffects.setVolume.bind(soundEffects);
soundEffects.setVolume = (volume: number) => {
    originalSetVolume(volume);
    notifyListeners();
};

/**
 * React Hook for sound effects
 */
export function useSound() {
    // 使用 useSyncExternalStore 来同步状态
    const enabled = useSyncExternalStore(
        subscribe,
        () => soundEffects.isEnabled(),
        () => true // SSR fallback
    );

    const volume = useSyncExternalStore(
        subscribe,
        () => soundEffects.getVolume(),
        () => 0.5 // SSR fallback
    );

    // 播放音效
    const play = useCallback((type: SoundType) => {
        soundEffects.play(type);
    }, []);

    // 播放音效 + 触觉
    const playWithHaptic = useCallback((
        type: SoundType,
        hapticPattern: 'light' | 'medium' | 'heavy' = 'light'
    ) => {
        soundEffects.playWithHaptic(type, hapticPattern);
    }, []);

    // 触觉反馈
    const haptic = useCallback((pattern: 'light' | 'medium' | 'heavy' = 'light') => {
        soundEffects.haptic(pattern);
    }, []);

    // 设置启用状态
    const setEnabled = useCallback((value: boolean) => {
        soundEffects.setEnabled(value);
    }, []);

    // 切换启用状态
    const toggle = useCallback(() => {
        soundEffects.setEnabled(!soundEffects.isEnabled());
    }, []);

    // 设置音量
    const setVolume = useCallback((value: number) => {
        soundEffects.setVolume(value);
    }, []);

    return {
        // 状态
        enabled,
        volume,

        // 方法
        play,
        playWithHaptic,
        haptic,
        setEnabled,
        toggle,
        setVolume,
    };
}

// 便捷方法：直接播放音效（不需要 hook）
export const playSound = (type: SoundType) => soundEffects.play(type);
export const playSoundWithHaptic = (
    type: SoundType,
    hapticPattern: 'light' | 'medium' | 'heavy' = 'light'
) => soundEffects.playWithHaptic(type, hapticPattern);

export type { SoundType };
