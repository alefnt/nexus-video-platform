/**
 * 全局状态管理 (Zustand)
 * 
 * 统一管理用户认证、积分余额、通知等全局状态，
 * 替代散落在 sessionStorage 中的零散读写。
 */

import { create } from 'zustand';

// ============== 用户状态 ==============

interface UserInfo {
    id: string;
    bitDomain?: string;
    ckbAddress?: string;
    nickname?: string;
    avatar?: string;
    email?: string;
    role?: string;
}

interface AuthState {
    jwt: string | null;
    user: UserInfo | null;
    isLoggedIn: boolean;

    // Actions
    login: (jwt: string, user: UserInfo) => void;
    logout: () => void;
    updateUser: (partial: Partial<UserInfo>) => void;
}

export const useAuthStore = create<AuthState>((set) => {
    let initialJwt: string | null = null;
    let initialUser: UserInfo | null = null;
    try {
        initialJwt = sessionStorage.getItem('vp.jwt');
        const userStr = sessionStorage.getItem('vp.user');
        if (userStr) initialUser = JSON.parse(userStr);
    } catch { }

    return {
        jwt: initialJwt,
        user: initialUser,
        isLoggedIn: !!initialJwt,

        login: (jwt, user) => {
            sessionStorage.setItem('vp.jwt', jwt);
            sessionStorage.setItem('vp.user', JSON.stringify(user));
            set({ jwt, user, isLoggedIn: true });
        },

        logout: () => {
            sessionStorage.removeItem('vp.jwt');
            sessionStorage.removeItem('vp.user');
            sessionStorage.removeItem('vp.offlineToken');
            set({ jwt: null, user: null, isLoggedIn: false });
        },

        updateUser: (partial) => {
            set((state) => {
                const updated = state.user ? { ...state.user, ...partial } : null;
                if (updated) sessionStorage.setItem('vp.user', JSON.stringify(updated));
                return { user: updated };
            });
        },
    };
});

/**
 * Non-React access to auth state. Use in libs, API clients, event handlers.
 * In React components, use `useAuthStore()` hook instead.
 */
export function getAuth() {
    return useAuthStore.getState();
}

export type { UserInfo };

// ============== 积分状态 ==============

interface PointsState {
    balance: number;
    lastUpdated: string | null;

    setBalance: (balance: number) => void;
    deduct: (amount: number) => void;
    credit: (amount: number) => void;
}

export const usePointsStore = create<PointsState>((set) => ({
    balance: 0,
    lastUpdated: null,

    setBalance: (balance) => set({ balance, lastUpdated: new Date().toISOString() }),
    deduct: (amount) => set((s) => ({ balance: Math.max(0, s.balance - amount), lastUpdated: new Date().toISOString() })),
    credit: (amount) => set((s) => ({ balance: s.balance + amount, lastUpdated: new Date().toISOString() })),
}));

// ============== UI 状态 ==============

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface UIState {
    toasts: ToastItem[];
    isSidebarOpen: boolean;

    addToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
    toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    toasts: [],
    isSidebarOpen: false,

    addToast: (type, message, duration = 4000) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ toasts: [...s.toasts, { id, type, message, duration }] }));
        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
            }, duration);
        }
    },

    removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}));
