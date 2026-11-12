import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Download progress in the notification shade.
 *
 * The sheet already shows the bar, but a 46 MB download outlives a glance at the
 * app. One notification, replaced in place, so the shade shows the same number
 * without stacking. Android only — iOS would need a different presentation and
 * the app does not ship there yet.
 */

const CHANNEL_ID = 'glean-updates';
const NOTIFICATION_ID = 'glean-update-download';
const THROTTLE = 0.05; // redraw every 5%, not every chunk

let prepared = false;
let lastShown = -1;

async function prepare(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (prepared) return true;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return false;

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Updates',
      importance: Notifications.AndroidImportance.LOW, // no sound, no heads-up
      showBadge: false,
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    prepared = true;
    return true;
  } catch {
    return false;
  }
}

/** Post or refresh the download notification. Safe to call often. */
export async function showDownloadProgress(fraction: number, version: string): Promise<void> {
  const percent = Math.floor(fraction * 100);
  if (percent === lastShown) return;
  if (!(await prepare())) return;
  lastShown = percent;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: `Downloading Glean ${version}`,
        body: `${percent}% · keep the app open`,
        sticky: true,
        autoDismiss: false,
        data: { kind: 'update-download' },
      },
      trigger: null,
    });
  } catch {
    /* notifications are a courtesy; never break the download */
  }
}

/** Replace the progress line once the installer takes over. */
export async function showInstallReady(version: string): Promise<void> {
  if (!(await prepare())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: `Glean ${version} is ready to install`,
        body: 'Open Glean to finish',
        sticky: false,
        autoDismiss: true,
        data: { kind: 'update-ready' },
      },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
}

export async function clearDownloadNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {
    /* ignore */
  }
  lastShown = -1;
}
