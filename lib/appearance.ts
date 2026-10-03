import { Appearance, useColorScheme } from 'react-native';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accents, darkColors, lightColors, type AccentKey, type AppColors } from '../constants/theme';

export type AppearanceMode = 'system' | 'light' | 'dark';

const MODE_KEY = 'glean:appearance';
const ACCENT_KEY = 'glean:accent';

function applyScheme(mode: AppearanceMode) {
  // Forcing the scheme makes useColorScheme() and NativeWind `dark:` follow it.
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

interface AppearanceState {
  mode: AppearanceMode;
  accent: AccentKey;
  setMode: (mode: AppearanceMode) => void;
  setAccent: (accent: AccentKey) => void;
  hydrate: () => void;
}

export const useAppearance = create<AppearanceState>(set => ({
  mode: 'system',
  accent: 'coral',
  setMode: (mode) => {
    set({ mode });
    applyScheme(mode);
    void AsyncStorage.setItem(MODE_KEY, mode);
  },
  setAccent: (accent) => {
    set({ accent });
    void AsyncStorage.setItem(ACCENT_KEY, accent);
  },
  hydrate: () => {
    AsyncStorage.multiGet([MODE_KEY, ACCENT_KEY])
      .then(entries => {
        const map = Object.fromEntries(entries);
        const mode = map[MODE_KEY];
        if (mode === 'light' || mode === 'dark' || mode === 'system') {
          set({ mode });
          applyScheme(mode);
        }
        const accent = map[ACCENT_KEY];
        if (accent && accent in accents) set({ accent: accent as AccentKey });
      })
      .catch(() => { /* ignore */ });
  },
}));

/** Current colour tokens for the active scheme + accent. */
export function useColors(): AppColors {
  const accent = useAppearance(s => s.accent);
  const isDark = useColorScheme() === 'dark';
  const base = isDark ? darkColors : lightColors;
  const a = accents[accent] ?? accents.coral;
  return {
    ...base,
    accent: a.accent,
    onAccent: '#FFFFFF',
    accentSoft: isDark ? a.softDark : a.soft,
    accentBorder: isDark ? a.borderDark : a.border,
  };
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
