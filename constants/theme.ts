// Design tokens — Airbnb-inspired direction.
// Single source of truth for inline styles; keep aligned with NativeWind className usage.

export const palette = {
  ink: '#222222',
  muted: '#717171',
  faint: '#B0B0B0',
  line: '#DDDDDD',
  lineLight: '#EBEBEB',
  surfaceMuted: '#F7F7F7',
  white: '#FFFFFF',
  black: '#000000',
  rausch: '#FF385C',
  rauschSoft: '#FFF1F3',
  rauschBorder: '#FFB3C1',
  green: '#008A05',
  red: '#C13515',
} as const;

export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderLight: string;
  borderStrong: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentBorder: string;
  disabledBg: string;
  disabledText: string;
  chipBg: string;
  chipActive: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;
  success: string;
  successBright: string;
  info: string;
  infoSoft: string;
  snackbarBg: string;
  overlay: string;
  pressed: string;
  shadow: string;
};

export const lightColors: AppColors = {
  background: palette.white,
  surface: palette.white,
  surfaceMuted: palette.surfaceMuted,
  surfaceSunken: palette.surfaceMuted,

  // All text tokens pass WCAG AA (4.5:1) on surface.
  text: palette.ink,
  textMuted: palette.muted,
  textFaint: palette.muted,

  border: palette.line,
  borderLight: palette.lineLight,
  borderStrong: palette.faint,

  // Neutral emphasis (headings, dark surfaces) vs. brand accent (actions, selection).
  primary: palette.ink,
  onPrimary: palette.white,
  accent: palette.rausch,
  onAccent: palette.white,
  accentSoft: palette.rauschSoft,
  accentBorder: palette.rauschBorder,

  disabledBg: palette.lineLight,
  disabledText: palette.faint,

  chipBg: palette.surfaceMuted,
  chipActive: palette.ink,

  danger: palette.red,
  dangerBg: '#FCEEEA',
  dangerBorder: '#F5C6B5',
  dangerText: palette.red,

  warning: '#B45309',
  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  success: palette.green,
  successBright: '#34D399',
  info: '#2563EB',
  infoSoft: '#93C5FD',

  snackbarBg: palette.ink,
  overlay: 'rgba(0, 0, 0, 0.25)',
  pressed: 'rgba(0, 0, 0, 0.06)',
  shadow: palette.black,
};

export const darkColors: AppColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceMuted: '#2A2A2A',
  surfaceSunken: '#2A2A2A',

  text: '#F2F2F2',
  textMuted: '#B3B3B3',
  textFaint: '#B3B3B3',

  border: '#333333',
  borderLight: '#2A2A2A',
  borderStrong: '#555555',

  primary: '#F2F2F2',
  onPrimary: '#121212',
  accent: palette.rausch,
  onAccent: palette.white,
  accentSoft: '#3A1F27',
  accentBorder: '#7A2E3C',

  disabledBg: '#2A2A2A',
  disabledText: '#6B6B6B',

  chipBg: '#2A2A2A',
  chipActive: '#F2F2F2',

  danger: '#FF6B6B',
  dangerBg: '#3A1E1E',
  dangerBorder: '#7A3A3A',
  dangerText: '#FF8A8A',

  warning: '#F0A32E',
  warningBg: '#3A2E12',
  warningBorder: '#6B5320',
  warningText: '#FFC46B',

  success: '#34C759',
  successBright: '#34D399',
  info: '#64B5F6',
  infoSoft: '#90CAF9',

  snackbarBg: '#F2F2F2',
  overlay: 'rgba(0, 0, 0, 0.55)',
  pressed: 'rgba(255, 255, 255, 0.10)',
  shadow: '#000000',
};

// Legacy static (light) palette — prefer useColors() from lib/appearance in UI.
export const colors = lightColors;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  caption: 12,
  label: 14,
  body: 16,
  title: 18,
  heading: 22,
  display: 32,
} as const;

export const layout = {
  compactHeaderHeight: 56,
  largeTitleHeight: 56,
  screenPadding: 24,
} as const;

// Geist — static weights must be selected by family name (RN custom fonts).
export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/** Map a numeric/keyword fontWeight to the matching Geist family. */
export function fontForWeight(weight?: string | number | null): string {
  if (weight == null) return fonts.regular;
  const w = weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight);
  if (!Number.isFinite(w)) return fonts.regular;
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

/** Soft, low elevation — Airbnb-style. */
export const elevation = {
  floating: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  raised: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

export const theme = { colors, radii, spacing, type, layout, elevation, fonts, palette } as const;
