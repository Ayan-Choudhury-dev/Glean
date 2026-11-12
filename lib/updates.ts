import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

// Lightweight self-update check against GitHub releases (no store, no account).
// The app is distributed as an APK from GitHub, so the latest release tag is the
// source of truth.

const REPO = 'Ayan-Choudhury-dev/Glean';
const RELEASES = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface UpdateInfo {
  version: string;
  /** Release page — the fallback when the APK cannot be installed in-app. */
  url: string;
  /** Direct APK for this device, when the release has one. */
  apkUrl: string | null;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function currentVersion(): string {
  return String(Constants.expoConfig?.version ?? '0.0.0');
}

/**
 * Pick the APK for this device. Releases ship one APK per ABI; arm64-v8a covers
 * every Android phone from ~2016 on, and a 32-bit device that grabs the wrong
 * one fails at install, which we surface as "open the release page" instead.
 * ponytail: no ABI probe, add one if 32-bit installs become common.
 */
function pickApk(assets: { name?: string; browser_download_url?: string }[]): string | null {
  const apk = assets.find(a => (a.name ?? '').includes('arm64-v8a'))
    ?? assets.find(a => (a.name ?? '').endsWith('.apk'));
  return apk?.browser_download_url ?? null;
}

/** Returns the newer release when one exists, else null. Never throws. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(RELEASES, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      assets?: { name?: string; browser_download_url?: string }[];
    };
    const latest = String(data.tag_name ?? '').replace(/^v/, '');
    if (!latest) return null;
    if (compareVersions(latest, currentVersion()) <= 0) return null;
    return {
      version: latest,
      url: data.html_url ?? `https://github.com/${REPO}/releases/latest`,
      apkUrl: pickApk(data.assets ?? []),
    };
  } catch {
    return null;
  }
}

/**
 * Download the release APK and hand it to Android's installer.
 *
 * Android shows its own "update this app?" prompt; the app is replaced in place
 * and local SQLite data is untouched. Requires REQUEST_INSTALL_PACKAGES, and the
 * user must allow installs from Glean the first time.
 */
export async function downloadAndInstall(
  info: UpdateInfo,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (!info.apkUrl) throw new Error('This release has no APK attached.');

  const target = new File(Paths.cache, `glean-${info.version}.apk`);
  if (target.exists) target.delete();

  const download = File.createDownloadTask(info.apkUrl, target, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
    },
  });

  await download.downloadAsync();
  onProgress?.(1);

  const contentUri = await getContentUriAsync(target.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
