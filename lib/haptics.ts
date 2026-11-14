import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Haptics, with both Android mechanisms available.
 *
 * Two ways to make an Android phone buzz:
 *
 *  - `HapticFeedbackConstants` (`performAndroidHapticsAsync`): the system's own
 *    ticks — the back/home gesture, keyboard, long-press. Silent when the user
 *    has turned off "system vibration / touch feedback", because the system is
 *    free to refuse them.
 *  - `Vibrator` (`Vibration.vibrate`): always fires while the app holds the
 *    VIBRATE permission, but you control only duration, not amplitude, so a long
 *    pulse reads as a buzz.
 *
 * The bench in Developer plays both so the phone can decide which is live.
 */

export type HapticMode = 'system' | 'vibrator';

/** Which mechanism the UI uses. Switch here once the bench says what works. */
export const HAPTIC_MODE: HapticMode = 'system';

/** Short enough to read as a tick rather than a buzz. */
const PULSE_MS = 12;

function system(type: Haptics.AndroidHaptics) {
  void Haptics.performAndroidHapticsAsync(type).catch(() => {});
}

function pulse(ms = PULSE_MS) {
  try {
    Vibration.vibrate(ms);
  } catch {
    /* no vibrator */
  }
}

/** Choosing something: filter, swatch, row, stepper. */
export function tapHaptic() {
  if (Platform.OS !== 'android') {
    void Haptics.selectionAsync();
    return;
  }
  if (HAPTIC_MODE === 'vibrator') return pulse();
  system(Haptics.AndroidHaptics.Gesture_End);
}

/** Flipping a value: a switch, a segment, a mode change. */
export function toggleHaptic() {
  if (Platform.OS !== 'android') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }
  if (HAPTIC_MODE === 'vibrator') return pulse(16);
  system(Haptics.AndroidHaptics.Toggle_On);
}

/** Completing something that mattered: saved, connected, installed. */
export function confirmHaptic() {
  if (Platform.OS !== 'android') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return;
  }
  if (HAPTIC_MODE === 'vibrator') return pulse(20);
  system(Haptics.AndroidHaptics.Confirm);
}

/** Rejected / destructive result. */
export function rejectHaptic() {
  if (Platform.OS !== 'android') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return;
  }
  if (HAPTIC_MODE === 'vibrator') return pulse(30);
  system(Haptics.AndroidHaptics.Reject);
}

/**
 * Named effects for the Developer bench.
 *
 * The first group is the system's; the second is the vibrator, which is the
 * fallback when the system refuses. `kind` decides which path plays.
 */
export type HapticDemo = { label: string; kind: HapticMode; value?: Haptics.AndroidHaptics; ms?: number };

export const HAPTIC_DEMO: HapticDemo[] = [
  { label: 'System · gesture end (back/home)', kind: 'system', value: Haptics.AndroidHaptics.Gesture_End },
  { label: 'System · gesture start', kind: 'system', value: Haptics.AndroidHaptics.Gesture_Start },
  { label: 'System · segment tick', kind: 'system', value: Haptics.AndroidHaptics.Segment_Tick },
  { label: 'System · context click', kind: 'system', value: Haptics.AndroidHaptics.Context_Click },
  { label: 'System · virtual key', kind: 'system', value: Haptics.AndroidHaptics.Virtual_Key },
  { label: 'System · keyboard tap', kind: 'system', value: Haptics.AndroidHaptics.Keyboard_Tap },
  { label: 'System · toggle on', kind: 'system', value: Haptics.AndroidHaptics.Toggle_On },
  { label: 'System · confirm', kind: 'system', value: Haptics.AndroidHaptics.Confirm },
  { label: 'System · reject', kind: 'system', value: Haptics.AndroidHaptics.Reject },
  { label: 'Vibrator · 8 ms', kind: 'vibrator', ms: 8 },
  { label: 'Vibrator · 12 ms', kind: 'vibrator', ms: 12 },
  { label: 'Vibrator · 20 ms', kind: 'vibrator', ms: 20 },
  { label: 'Vibrator · 35 ms', kind: 'vibrator', ms: 35 },
];

export function playHapticDemo(entry: HapticDemo) {
  if (Platform.OS !== 'android') {
    void Haptics.selectionAsync();
    return;
  }
  if (entry.kind === 'vibrator') return pulse(entry.ms ?? PULSE_MS);
  if (entry.value) system(entry.value);
}
