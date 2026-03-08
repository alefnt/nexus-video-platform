/**
 * 🔊 Sound Effects Manager
 * 轻量级音效反馈系统，使用 Web Audio API
 */

type SoundType =
    | 'click'      // 普通点击
    | 'success'    // 成功操作
    | 'error'      // 错误提示
    | 'coin'       // 获得积分/金币
    | 'checkin'    // 签到成功
    | 'achievement'// 成就解锁
    | 'levelUp'    // 升级
    | 'notification'// 通知
    | 'spin'       // 转盘旋转
    | 'prize'      // 中奖
    | 'whoosh';    // 页面切换

// 音效配置：频率、持续时间、音量、波形
interface SoundConfig {
    frequencies: number[];
    durations: number[];
    volumes: number[];
    type: OscillatorType;
    delay?: number;
}

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
    click: {
        frequencies: [800, 600],
        durations: [0.05, 0.05],
        volumes: [0.1, 0.05],
        type: 'sine'
    },
    success: {
        frequencies: [523, 659, 784],
        durations: [0.1, 0.1, 0.15],
        volumes: [0.15, 0.15, 0.2],
        type: 'sine'
    },
    error: {
        frequencies: [200, 150],
        durations: [0.15, 0.2],
        volumes: [0.15, 0.1],
        type: 'sawtooth'
    },
    coin: {
        frequencies: [987, 1318],
        durations: [0.08, 0.12],
        volumes: [0.12, 0.15],
        type: 'sine'
    },
    checkin: {
        frequencies: [440, 554, 659, 880],
        durations: [0.1, 0.1, 0.1, 0.2],
        volumes: [0.1, 0.12, 0.14, 0.18],
        type: 'sine'
    },
    achievement: {
        frequencies: [523, 659, 784, 1047, 1318],
        durations: [0.12, 0.12, 0.12, 0.15, 0.25],
        volumes: [0.1, 0.12, 0.14, 0.16, 0.2],
        type: 'sine'
    },
    levelUp: {
        frequencies: [440, 554, 659, 880, 1108, 1318],
        durations: [0.08, 0.08, 0.08, 0.1, 0.1, 0.2],
        volumes: [0.08, 0.1, 0.12, 0.14, 0.16, 0.2],
        type: 'triangle'
    },
    notification: {
        frequencies: [880, 1108],
        durations: [0.1, 0.15],
        volumes: [0.12, 0.08],
        type: 'sine'
    },
    spin: {
        frequencies: [300, 350, 400, 450, 500],
        durations: [0.05, 0.05, 0.05, 0.05, 0.05],
        volumes: [0.08, 0.08, 0.08, 0.08, 0.08],
        type: 'square'
    },
    prize: {
        frequencies: [523, 659, 784, 1047, 784, 1047, 1318, 1568],
        durations: [0.1, 0.1, 0.1, 0.15, 0.1, 0.1, 0.15, 0.3],
        volumes: [0.1, 0.12, 0.14, 0.16, 0.14, 0.16, 0.18, 0.22],
        type: 'sine'
    },
    whoosh: {
        frequencies: [400, 200, 100],
        durations: [0.05, 0.08, 0.1],
        volumes: [0.08, 0.06, 0.04],
        type: 'sawtooth'
    }
};

class SoundEffects {
    private audioContext: AudioContext | null = null;
    private enabled: boolean = true;
    private volume: number = 0.5;
    private initialized: boolean = false;

    constructor() {
        // 从 localStorage 读取设置
        if (typeof window !== 'undefined') {
            const savedEnabled = localStorage.getItem('sound_enabled');
            const savedVolume = localStorage.getItem('sound_volume');

            if (savedEnabled !== null) {
                this.enabled = savedEnabled === 'true';
            }
            if (savedVolume !== null) {
                this.volume = parseFloat(savedVolume);
            }
        }
    }

    /**
     * 初始化 AudioContext（需要用户交互后调用）
     */
    private init(): boolean {
        if (this.initialized && this.audioContext) {
            return true;
        }

        try {
            // 创建 AudioContext
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
                console.warn('Web Audio API not supported');
                return false;
            }

            this.audioContext = new AudioContextClass();
            this.initialized = true;

            // 如果被暂停，恢复
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            return true;
        } catch (e) {
            console.warn('Failed to initialize AudioContext:', e);
            return false;
        }
    }

    /**
     * 播放音效
     */
    play(type: SoundType): void {
        if (!this.enabled) return;
        if (!this.init()) return;
        if (!this.audioContext) return;

        const config = SOUND_CONFIGS[type];
        if (!config) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        let currentTime = now;

        config.frequencies.forEach((freq, i) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = config.type;
            oscillator.frequency.setValueAtTime(freq, currentTime);

            const volume = config.volumes[i] * this.volume;
            const duration = config.durations[i];

            // 音量包络
            gainNode.gain.setValueAtTime(0, currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(volume * 0.7, currentTime + duration * 0.7);
            gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(currentTime);
            oscillator.stop(currentTime + duration + 0.05);

            currentTime += duration * 0.8; // 轻微重叠
        });
    }

    /**
     * 启用/禁用音效
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (typeof window !== 'undefined') {
            localStorage.setItem('sound_enabled', String(enabled));
        }
    }

    /**
     * 获取启用状态
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * 设置音量 (0-1)
     */
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        if (typeof window !== 'undefined') {
            localStorage.setItem('sound_volume', String(this.volume));
        }
    }

    /**
     * 获取音量
     */
    getVolume(): number {
        return this.volume;
    }

    /**
     * 触觉反馈（如果设备支持）
     */
    haptic(pattern: 'light' | 'medium' | 'heavy' = 'light'): void {
        if (!this.enabled) return;

        if ('vibrate' in navigator) {
            const patterns = {
                light: [10],
                medium: [20],
                heavy: [30, 10, 30]
            };
            navigator.vibrate(patterns[pattern]);
        }
    }

    /**
     * 播放音效 + 触觉反馈
     */
    playWithHaptic(type: SoundType, hapticPattern: 'light' | 'medium' | 'heavy' = 'light'): void {
        this.play(type);
        this.haptic(hapticPattern);
    }
}

// 单例导出
export const soundEffects = new SoundEffects();

// 类型导出
export type { SoundType };
