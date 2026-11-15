import { create } from 'zustand';

/**
 * Switches for decisions we have not settled, so they can be judged on a phone
 * without a build.
 *
 * In memory only: they reset on relaunch, which is right for a test bench. If
 * one of these becomes a real preference it moves to the store with the rest.
 */
export type HapticsMode = 'system' | 'vibrator';

interface DevFlags {
  hapticsMode: HapticsMode;
  /** PocketBase realtime subscriptions. Off = refresh on foreground only. */
  realtime: boolean;
  /** Restock suggestions shelf on the shopping list. */
  suggestions: boolean;
  setHapticsMode: (mode: HapticsMode) => void;
  toggleRealtime: () => void;
  toggleSuggestions: () => void;
}

export const useDevFlags = create<DevFlags>(set => ({
  hapticsMode: 'vibrator',
  realtime: true,
  suggestions: true,
  setHapticsMode: hapticsMode => set({ hapticsMode }),
  toggleRealtime: () => set(state => ({ realtime: !state.realtime })),
  toggleSuggestions: () => set(state => ({ suggestions: !state.suggestions })),
}));
