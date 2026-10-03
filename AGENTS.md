# AGENTS.md

Guidelines for AI agents working in this repo. Read before making changes.

## Project state: mid-migration (uncommitted)

This repo is mid-migration from gluestack-ui to nativewind + plain Tailwind, and from Expo SDK 54 → 57. The working tree contains a large amount of **intentional uncommitted migration work**:

- `components/ui/*` are rewritten as thin wrappers that forward `className` to native primitives (`Pressable`, `Text`, `View`).
- `components/ui/gluestack-ui-provider/`, `*.web.tsx`, and `styles.tsx` files are **deliberately deleted**.
- `tailwind.config.js` is **deliberately minimal** (`content` + `presets: [require('nativewind/preset')]`). Do NOT restore the old gluestack-era config from git — its theme references `rgb(var(--color-primary-*))` CSS variables that no longer exist anywhere.

**Never `git checkout`/revert files to HEAD to "fix" things.** HEAD is the pre-migration state; the working tree is the source of truth.

## NativeWind rules (learned the hard way)

1. **Custom components must NOT self-register with `cssInterop`.** The correct pattern (used by every `components/ui/*` component) is to forward `className` to a native primitive — NativeWind already interops `Pressable`/`Text`/`View`/etc. Registering a wrapper component with `cssInterop` AND forwarding `className` to an interop'd child creates a nested/double interop that corrupts inline `style` objects on Android (symptoms: views invisible, layouts mangled, "CSS gone"). This cost several hours of debugging in Aug 2026 — see `components/ui/tappable.tsx` history.
2. Screens that use **only inline styles** (e.g. `app/(tabs)/index.tsx`, `shopping.tsx`) are unaffected by Tailwind config — if those break, the cause is in the component wrapping them, not CSS.
3. Class usage is standard Tailwind palette only (`slate`, `gray`, `red`, `emerald`). No custom theme colors.

## Native behaviours (ripple, haptics, press feedback)

Use the shared `components/ui/tappable.tsx` (`Tappable`) for tappable surfaces:
- Android: bounded Material ripple via `android_ripple` (RN built-in, no library).
- iOS: pressed-state opacity dim.
- Haptics: opt-in only for deliberate primary actions; do not add haptics to every tap.

Do not add per-screen press-feedback code; extend `Tappable` if a variant is needed. `expo-haptics` is a native module — changes to it require a dev-client rebuild (`npx expo run:ios` / `run:android`), while JS-side changes do not.

Do not override react-navigation's `tabBarButton` with custom components — its default button already handles native press feedback, and overrides have caused tab-bar misalignment. Tab-switch animation lives in `TabIcon` in `app/(tabs)/_layout.tsx` (reanimated spring on the focused pill).

## Verification workflow

After any change:
1. `npx tsc --noEmit` must pass.
2. For style/native changes: restart Metro with `--clear`.
3. Test on Android AND iOS — ripple/keyboard/edge-to-edge behaviour differs per platform.

## Other rules

- Never commit secrets (Supabase keys from `.env`).
- The store is `store/useGleanStore.ts` (zustand + Supabase, debounced fire-and-forget writes).
- Never commit or revert anything without the user asking.
