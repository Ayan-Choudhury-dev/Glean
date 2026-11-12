# Design system

Glean is a quiet, Airbnb-leaning product UI: white surfaces, one accent colour,
soft elevation, generous type. This file records the tokens and the rules that
keep screens consistent. `constants/theme.ts` is the source of truth; if the two
disagree, the code wins and this file is wrong.

## Principles

1. **Content first.** No chrome that does not carry information. Borders are
   hairlines, shadows are soft, nothing glows.
2. **One accent.** `accent` marks actions and selection. Everything else is ink
   on surface. Colour is a signal, not decoration.
3. **Touch is the primary input.** 44pt minimum targets, press feedback on every
   tappable surface, safe areas respected.
4. **Dark mode is a first-class palette**, not an inversion filter.

## Colour

Light and dark palettes live in `lightColors` / `darkColors` in
`constants/theme.ts`. Read them at runtime through `useColors()` in
`lib/appearance.ts` — never import `colors` (the static light palette) into a
screen.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` / `surface` | `#FFFFFF` | `#121212` / `#1E1E1E` | screen and card background |
| `surfaceMuted` | `#F7F7F7` | `#2A2A2A` | chips, inputs, wells |
| `text` | `#222222` | `#F2F2F2` | body and headings |
| `textMuted` | `#717171` | `#B3B3B3` | secondary labels |
| `border` | `#DDDDDD` | `#333333` | dividers, input outlines |
| `accent` | `#FF385C` | `#FF385C` | primary actions, selected state |
| `accentSoft` | `#FFF1F3` | `#3A1F27` | selected chip / icon pill |
| `danger` | `#C13515` | `#FF6B6B` | destructive actions, out-of-stock |
| `warning` | `#B45309` | `#F0A32E` | low-stock |
| `success` | `#008A05` | `#34C759` | restock confirmation |

Text tokens pass WCAG AA on their surface. Do not put `textMuted` on
`surfaceMuted` at caption size — it drops under 4.5:1.

Accent presets (`accents` in `constants/theme.ts`): coral (default), emerald,
blue, violet, amber. Each has light and dark soft/border values. The accent is
stored per user and applied through `useColors()`.

## Type

Geist for UI, Fraunces for display headings, Geist Mono for quantities.

| Token | px | Use |
|---|---|---|
| `micro` | 11 | tab labels, badges |
| `caption` | 12 | timestamps, helper text |
| `sm` | 13 | secondary meta |
| `label` | 14 | buttons, list secondary |
| `md` | 15 | list primary, body in sheets |
| `body` | 16 | body copy |
| `title` | 18 | sheet titles |
| `heading` | 22 | screen headings |
| `display` | 32 | large titles, onboarding |

Weight is a family in React Native, not a number: use `fonts.regular`,
`fonts.medium`, `fonts.semibold`, `fonts.bold`, or `fontForWeight()`. Never set
`fontWeight` on a custom font — Android renders the wrong weight.

## Space, radius, elevation

- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32` (`spacing`). Screen padding 24.
- Radii: `6 / 8 / 12 / 16 / 20 / 28 / pill` (`radii`). Cards `lg`, buttons `md`,
  chips and icon pills `pill`.
- Elevation: `elevation.raised` for cards, `elevation.floating` for sheets and
  the sticky action bar. Two levels only.

## Components

- **Tappable** (`components/ui/tappable.tsx`) — every pressable surface. Android
  bounded ripple, iOS opacity dim, optional haptic for primary actions. Do not
  hand-roll `Pressable` with its own feedback.
- **NativeSheet** — bottom sheet for add/edit flows. Rounded top corners, grab
  area, keyboard-avoiding.
- **CollapsibleHeader** — large title that collapses into a compact bar on
  scroll. Uses an `Animated.ScrollView` because the scroll event is native-driven.
- **Chips** — `pill` radius, `chipBg` → `chipActive` (ink) when selected.

## Screen rules

- One large title per screen, collapsing on scroll, left-aligned.
- Primary action is either a sticky bottom bar (add/edit flows) or a floating
  button above the tab bar — never both.
- Empty states are one line of muted text plus the action that fills them.
- Loading is a skeleton, not a spinner, for lists; spinners only inside buttons.
- Destructive actions confirm inline (a second row appears), not with a modal.

## Accessibility

- Minimum 44×44pt targets; icon-only buttons carry `accessibilityLabel`.
- Never rely on colour alone: low stock is text *and* colour.
- Respect `prefers-reduced-motion` — springs become instant when set.
- Text scales: layouts use `flexShrink`/`numberOfLines`, not fixed widths.
