import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  language: 'en' | 'zh';
  autoplay: boolean;
  quality: 'auto' | '1080p' | '720p' | '480p';
  danmakuEnabled: boolean;
  danmakuOpacity: number;
  playbackSpeed: number;
  notifications: {
    push: boolean;
    email: boolean;
    live: boolean;
    tips: boolean;
  };
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  language: 'zh',
  autoplay: true,
  quality: 'auto',
  danmakuEnabled: true,
  danmakuOpacity: 0.8,
  playbackSpeed: 1,
  notifications: { push: true, email: false, live: true, tips: true },
};

interface PreferencesState extends UserPreferences {
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetPreferences: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      setPreference: (key, value) => set({ [key]: value }),
      resetPreferences: () => set(defaultPreferences),
    }),
    { name: 'nexus-preferences' }
  )
);
