// Design tokens — "Fresh Pantry" direction.
// Single source of truth for inline styles; keep aligned with NativeWind className usage.

export const palette = {
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  white: '#FFFFFF',
  black: '#000000',
  emerald600: '#059669',
  emerald50: '#ECFDF5',
  emerald200: '#A7F3D0',
} as const;

export const colors = {
  background: '#F6F7F9',
  surface: palette.white,
  surfaceMuted: '#F8FAFC',
  surfaceSunken: '#EEF1F4',

  // All text tokens pass WCAG AA (4.5:1) on surface.
  text: palette.slate900,
  textMuted: palette.slate600,
  textFaint: palette.slate500,

  border: '#E4E7EB',
  borderLight: '#EEF1F4',
  borderStrong: palette.slate300,

  // Neutral emphasis (headings, dark surfaces) vs. action accent (buttons, selection).
  primary: palette.slate900,
  onPrimary: palette.white,
  accent: palette.emerald600,
  onAccent: palette.white,
  accentSoft: palette.emerald50,
  accentBorder: palette.emerald200,

  disabledBg: '#EEF1F4',
  disabledText: palette.slate400,

  chipBg: '#EEF1F4',
  chipActive: palette.slate900,

  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FECACA',
  dangerText: '#991B1B',

  warning: '#B45309',
  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  success: palette.emerald600,
  successBright: '#34D399',
  info: '#2563EB',
  infoSoft: '#93C5FD',

  snackbarBg: palette.slate800,
  overlay: 'rgba(0, 0, 0, 0.25)',
  pressed: 'rgba(5, 150, 105, 0.12)',
  shadow: palette.slate900,
} as const;

export const radii = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  caption: 12,
  label: 14,
  body: 16,
  title: 17,
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

/** Soft two-layer elevation for floating surfaces only; cards use hairline borders. */
export const elevation = {
  floating: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  raised: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export const theme = { colors, radii, spacing, type, layout, elevation, fonts, palette } as const;
