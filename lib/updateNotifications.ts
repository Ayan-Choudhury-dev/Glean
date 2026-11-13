import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * One notification, at the end of the download.
 *
 * No progress in the shade: the sheet already shows the bar, and a notification
 * that rewrites itself every 5% is noise for a download the user started and is
 * watching. This only speaks when the APK is on disk and the installer is the
 * next step.
 */

const CHANNEL_ID = 'glean-updates';
const NOTIFICATION_ID = 'glean-update-ready';

let prepared = false;

async function prepare(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (prepared) return true;
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
    });
    prepared = true;
    return true;
  } catch {
    return false;
  }
}

/** "Glean 1.0.10 is ready to install" — tapping opens the app. */
export async function showInstallReady(version: string): Promise<void> {
  if (!(await prepare())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: `Glean ${version} is ready to install`,
        body: 'Tap to finish. Your pantry is kept.',
        autoDismiss: true,
        data: { kind: 'update-ready' },
      },
      trigger: null,
    });
  } catch {
    /* a missing notification must never break the update */
  }
}

export async function clearUpdateNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {
    /* ignore */
  }
}
