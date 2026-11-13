import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Haptics, mapped to what the platform actually has.
 *
 * Android has no Taptic Engine. `HapticFeedbackConstants` are short,
 * amplitude-controlled effects the system (and Samsung's own UI) uses for
 * controls; `impactAsync` instead drives the vibrator for a duration, which is
 * the buzz you feel on a Samsung. So on Android we ask for the specific
 * constant, and only fall back to `impactAsync` when the effect is unavailable.
 */

function android(type: Haptics.AndroidHaptics) {
  void Haptics.performAndroidHapticsAsync(type).catch(() => {});
}

/** Choosing something: filter, swatch, row, stepper. The "hard tap". */
export function tapHaptic() {
  if (Platform.OS === 'android') return android(Haptics.AndroidHaptics.Context_Click);
  void Haptics.selectionAsync();
}

/** Flipping a value: a switch, a segment, a mode change. */
export function toggleHaptic() {
  if (Platform.OS === 'android') return android(Haptics.AndroidHaptics.Toggle_On);
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Completing something that mattered: saved, connected, installed. */
export function confirmHaptic() {
  if (Platform.OS === 'android') return android(Haptics.AndroidHaptics.Confirm);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Rejected / destructive result. */
export function rejectHaptic() {
  if (Platform.OS === 'android') return android(Haptics.AndroidHaptics.Reject);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
