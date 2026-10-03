// Design tokens — single source of truth for inline styles across screens.
// Keep aligned with the NativeWind slate palette used in className-based screens.

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
} as const;

export const colors = {
  background: '#FAFAFA',
  surface: palette.white,
  surfaceMuted: palette.slate50,
  surfaceSunken: palette.slate100,

  text: palette.slate900,
  textMuted: palette.slate500,
  textFaint: palette.slate400,

  border: palette.slate200,
  borderLight: palette.slate100,
  borderStrong: palette.slate300,

  primary: palette.slate900,
  onPrimary: palette.white,
  disabledBg: palette.slate200,
  disabledText: palette.slate400,

  chipBg: palette.slate100,
  chipActive: palette.slate900,

  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FECACA',
  dangerText: '#991B1B',

  warning: '#D97706',
  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  success: '#10B981',
  successBright: '#34D399',
  info: '#3B82F6',
  infoSoft: '#93C5FD',

  snackbarBg: '#1E293B',
  overlay: 'rgba(0, 0, 0, 0.25)',
  pressed: 'rgba(15, 23, 42, 0.08)',
  shadow: '#000000',
} as const;

export const radii = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  caption: 12,
  body: 14,
  bodyLg: 15,
  title: 16,
  heading: 20,
  display: 30,
} as const;

export const layout = { headerHeight: 64, screenPadding: 24 } as const;

export const theme = { colors, radii, spacing, type, layout, palette } as const;
