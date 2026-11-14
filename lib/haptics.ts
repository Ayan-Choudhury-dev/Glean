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

/**
 * Choosing something: filter, swatch, row, stepper.
 *
 * `GESTURE_END` is the tick the system itself plays for the back/home gesture —
 * the reference for "native". `CONTEXT_CLICK` is the heavier hard tap; the
 * Developer menu has both so you can compare on the phone.
 */
export function tapHaptic() {
  if (Platform.OS === 'android') return android(Haptics.AndroidHaptics.Gesture_End);
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

/**
 * Named Android effects, for the Developer menu.
 *
 * The system back/home gesture is the reference people mean by "native": it is
 * `GESTURE_END`, a single very short tick — not a vibrator pulse.
 */
export const ANDROID_HAPTIC_DEMO: { label: string; value: Haptics.AndroidHaptics }[] = [
  { label: 'Gesture end (system back/home)', value: Haptics.AndroidHaptics.Gesture_End },
  { label: 'Gesture start', value: Haptics.AndroidHaptics.Gesture_Start },
  { label: 'Segment tick (picker)', value: Haptics.AndroidHaptics.Segment_Tick },
  { label: 'Context click (long press)', value: Haptics.AndroidHaptics.Context_Click },
  { label: 'Virtual key', value: Haptics.AndroidHaptics.Virtual_Key },
  { label: 'Keyboard tap', value: Haptics.AndroidHaptics.Keyboard_Tap },
  { label: 'Toggle on', value: Haptics.AndroidHaptics.Toggle_On },
  { label: 'Confirm', value: Haptics.AndroidHaptics.Confirm },
  { label: 'Reject', value: Haptics.AndroidHaptics.Reject },
  { label: 'Long press', value: Haptics.AndroidHaptics.Long_Press },
];

export function playAndroidHaptic(value: Haptics.AndroidHaptics) {
  if (Platform.OS === 'android') return android(value);
  void Haptics.selectionAsync();
}
