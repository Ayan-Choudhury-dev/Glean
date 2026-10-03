import { Appearance, useColorScheme } from 'react-native';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type AppColors } from '../constants/theme';

export type AppearanceMode = 'system' | 'light' | 'dark';

const KEY = 'glean:appearance';

function applyScheme(mode: AppearanceMode) {
  // Forcing the scheme makes useColorScheme() and NativeWind `dark:` follow it.
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

interface AppearanceState {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  hydrate: () => void;
}

export const useAppearance = create<AppearanceState>(set => ({
  mode: 'system',
  setMode: (mode) => {
    set({ mode });
    applyScheme(mode);
    void AsyncStorage.setItem(KEY, mode);
  },
  hydrate: () => {
    AsyncStorage.getItem(KEY)
      .then(value => {
        if (value === 'light' || value === 'dark' || value === 'system') {
          set({ mode: value });
          applyScheme(value);
        }
      })
      .catch(() => { /* ignore */ });
  },
}));

/** Current colour tokens for the active scheme. */
export function useColors(): AppColors {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

/** Alias map used by the tab screens (kept so their style objects stay terse). */
export function useC() {
  const c = useColors();
  return {
    bg: c.background,
    card: c.surface,
    text: c.text,
    muted: c.textMuted,
    faint: c.textFaint,
    border: c.border,
    borderLight: c.borderLight,
    chipBg: c.chipBg,
    chipActive: c.chipActive,
    primary: c.primary,
    accent: c.accent,
    accentSoft: c.accentSoft,
    accentBorder: c.accentBorder,
    onAccent: c.onAccent,
    danger: c.danger,
    dangerBg: c.dangerBg,
    warning: c.warning,
    warningBg: c.warningBg,
    green: c.success,
  };
}
