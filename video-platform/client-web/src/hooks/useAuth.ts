/**
 * 认证状态 Hook
 * 
 * 功能：
 * - 获取当前登录状态
 * - 获取用户信息
 * - 登录/登出方法
 * - JWT 管理
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiClient } from '../lib/apiClient';

interface User {
    id: string;
    userId?: string;
    ckbAddress?: string;
    bitDomain?: string;
    email?: string;
    role?: string;
    createdAt?: string;
}

interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    jwt: string | null;
}

export function useAuth() {
    const navigate = useNavigate();
    const [state, setState] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        jwt: null,
    });

    // 初始化：从 sessionStorage 恢复状态
    useEffect(() => {
        try {
            const jwt = sessionStorage.getItem('vp.jwt');
            const userStr = sessionStorage.getItem('vp.user');
            const user = userStr ? JSON.parse(userStr) : null;

            setState({
                isAuthenticated: !!jwt,
                isLoading: false,
                user,
                jwt,
            });
        } catch {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    // API Client (带 JWT)
    const apiClient = useMemo(() => {
        const client = getApiClient();
        if (state.jwt) client.setJWT(state.jwt);
        return client;
    }, [state.jwt]);

    // 登录
    const login = useCallback(async (jwt: string, user: User) => {
        sessionStorage.setItem('vp.jwt', jwt);
        sessionStorage.setItem('vp.user', JSON.stringify(user));
        setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            jwt,
        });
    }, []);

    // 登出
    const logout = useCallback(() => {
        sessionStorage.removeItem('vp.jwt');
        sessionStorage.removeItem('vp.user');
        sessionStorage.removeItem('vp.offlineToken');
        setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            jwt: null,
        });
        navigate('/login', { replace: true });
    }, [navigate]);

    // 检查登录状态
    const requireAuth = useCallback((redirectTo?: string) => {
        if (!state.isLoading && !state.isAuthenticated) {
            navigate(redirectTo || '/login', { replace: true });
            return false;
        }
        return state.isAuthenticated;
    }, [state.isAuthenticated, state.isLoading, navigate]);

    // 刷新用户信息
    const refreshUser = useCallback(async () => {
        if (!state.jwt) return;
        try {
            const client = getApiClient();
            client.setJWT(state.jwt);
            const user = await client.get<User>('/identity/me');
            if (user) {
                sessionStorage.setItem('vp.user', JSON.stringify(user));
                setState(prev => ({ ...prev, user }));
            }
        } catch (error) {
            console.warn('Failed to refresh user info:', error);
        }
    }, [state.jwt]);

    return {
        ...state,
        apiClient,
        login,
        logout,
        requireAuth,
        refreshUser,
    };
}

export default useAuth;
