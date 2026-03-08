import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, usePointsStore, useUIStore } from '../index';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts logged out', () => {
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().jwt).toBeNull();
  });

  it('logs in and out', () => {
    useAuthStore.getState().login('test-jwt', { id: '1', nickname: 'Test' });
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().jwt).toBe('test-jwt');
    
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });
});

describe('usePointsStore', () => {
  it('manages balance', () => {
    usePointsStore.getState().setBalance(100);
    expect(usePointsStore.getState().balance).toBe(100);
    
    usePointsStore.getState().deduct(30);
    expect(usePointsStore.getState().balance).toBe(70);
    
    usePointsStore.getState().credit(50);
    expect(usePointsStore.getState().balance).toBe(120);
  });
});

describe('useUIStore', () => {
  it('adds and removes toasts', () => {
    useUIStore.getState().addToast('success', 'Test message', 0);
    expect(useUIStore.getState().toasts.length).toBe(1);
    
    const id = useUIStore.getState().toasts[0].id;
    useUIStore.getState().removeToast(id);
    expect(useUIStore.getState().toasts.length).toBe(0);
  });
});
