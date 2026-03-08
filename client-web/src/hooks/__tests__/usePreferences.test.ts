import { describe, it, expect, beforeEach } from 'vitest';
import { usePreferences } from '../usePreferences';

describe('usePreferences', () => {
  beforeEach(() => {
    usePreferences.getState().resetPreferences();
  });

  it('has correct defaults', () => {
    const state = usePreferences.getState();
    expect(state.theme).toBe('dark');
    expect(state.language).toBe('zh');
    expect(state.autoplay).toBe(true);
    expect(state.quality).toBe('auto');
  });

  it('updates a preference', () => {
    usePreferences.getState().setPreference('theme', 'light');
    expect(usePreferences.getState().theme).toBe('light');
  });

  it('resets preferences', () => {
    usePreferences.getState().setPreference('theme', 'light');
    usePreferences.getState().setPreference('language', 'en');
    usePreferences.getState().resetPreferences();
    expect(usePreferences.getState().theme).toBe('dark');
    expect(usePreferences.getState().language).toBe('zh');
  });
});
