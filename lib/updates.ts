import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { clearUpdateNotification, showInstallReady } from './updateNotifications';
import { create } from 'zustand';

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
  /** Bytes, for the "12 of 46 MB" line. Null when the release omits it. */
  apkSize: number | null;
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
function pickApk(assets: { name?: string; browser_download_url?: string; size?: number }[]) {
  const apk = assets.find(a => (a.name ?? '').includes('arm64-v8a'))
    ?? assets.find(a => (a.name ?? '').endsWith('.apk'));
  if (!apk?.browser_download_url) return { apkUrl: null, apkSize: null };
  return { apkUrl: apk.browser_download_url, apkSize: apk.size ?? null };
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
      assets?: { name?: string; browser_download_url?: string; size?: number }[];
    };
    const latest = String(data.tag_name ?? '').replace(/^v/, '');
    if (!latest) return null;
    if (compareVersions(latest, currentVersion()) <= 0) return null;
    const { apkUrl, apkSize } = pickApk(data.assets ?? []);
    return {
      version: latest,
      url: data.html_url ?? `https://github.com/${REPO}/releases/latest`,
      apkUrl,
      apkSize,
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
/** Where a downloaded update lives. Documents, not cache: the OS may evict cache. */
export function apkFile(version: string): File {
  return new File(Paths.document, `glean-${version}.apk`);
}

/** True when a previous download is still on disk and can be installed as-is. */
export function hasSavedApk(version: string): boolean {
  try {
    return apkFile(version).exists;
  } catch {
    return false;
  }
}

export async function downloadAndInstall(
  info: UpdateInfo,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (!info.apkUrl) throw new Error('This release has no APK attached.');

  const target = apkFile(info.version);
  if (target.exists) target.delete();

  const download = File.createDownloadTask(info.apkUrl, target, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
    },
  });

  // Keep the screen on for the length of the transfer. This is not a
  // foreground service: Android can still suspend a backgrounded app, and the
  // task dies with the JS runtime. It stops the common failure — the screen
  // sleeping mid-download — without pretending to be a background service.
  const awakeTag = `glean-update-${info.version}`;
  await activateKeepAwakeAsync(awakeTag).catch(() => {});
  try {
    await download.downloadAsync();
  } finally {
    deactivateKeepAwake(awakeTag);
  }
  onProgress?.(1);

  await installApk(target);
}

/** Hand an APK already on disk to the system installer. */
export async function installApk(file: File): Promise<void> {
  const contentUri = await getContentUriAsync(file.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}

// ─── Shared state ────────────────────────────────────────────────────────────
// Both the launch check and the Settings row drive the same flow, so the sheet
// has one source of truth and cannot show two different states.

export type UpdatePhase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'opening' | 'error';

interface UpdateFlow {
  phase: UpdatePhase;
  info: UpdateInfo | null;
  progress: number;
  error: string | null;
  lastChecked: number | null;
  open: boolean;
  check: (options?: { openWhenAvailable?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  openSheet: () => void;
  closeSheet: () => void;
  installSaved: (version: string) => Promise<void>;
  /** Dev tools: drive the sheet without waiting for a real release. */
  preview: (mode: 'available' | 'downloading') => void;
  reset: () => void;
}

let previewTimer: ReturnType<typeof setInterval> | null = null;

export const useUpdateFlow = create<UpdateFlow>((set, get) => ({
  phase: 'idle',
  info: null,
  progress: 0,
  error: null,
  lastChecked: null,
  open: false,

  check: async (options) => {
    if (get().phase === 'checking' || get().phase === 'downloading') return;
    set({ phase: 'checking', error: null });
    const info = await checkForUpdate();
    if (!info) {
      set({ phase: 'current', info: null, lastChecked: Date.now() });
      return;
    }
    set({
      phase: 'available',
      info,
      lastChecked: Date.now(),
      open: options?.openWhenAvailable ? true : get().open,
    });
  },

  install: async () => {
    const { info } = get();
    if (!info) return;
    set({ phase: 'downloading', progress: 0, error: null, open: true });
    try {
      await downloadAndInstall(info, fraction => set({ progress: fraction }));
      set({ phase: 'opening' });
      void showInstallReady(info.version);
    } catch (e) {
      set({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
      void clearUpdateNotification();
    }
  },

  /** Install an APK from a previous download instead of fetching it again. */
  installSaved: async (version: string) => {
    try {
      await installApk(apkFile(version));
      set({ phase: 'opening', open: true });
    } catch (e) {
      set({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),

  preview: (mode) => {
    const fake: UpdateInfo = {
      version: '9.9.9',
      url: 'https://github.com/Ayan-Choudhury-dev/Glean/releases/latest',
      apkUrl: null,
      apkSize: 48_000_000,
    };
    if (mode === 'available') {
      set({ phase: 'available', info: fake, open: true, progress: 0, error: null });
      return;
    }
    // Walk the bar and fire the completion notification, no network involved.
    set({ phase: 'downloading', info: fake, open: true, progress: 0, error: null });
    previewTimer = setInterval(() => {
      const next = Math.min(1, get().progress + 0.04);
      set({ progress: next });
      if (next >= 1) {
        if (previewTimer) clearInterval(previewTimer);
        previewTimer = null;
        set({ phase: 'opening' });
        void showInstallReady(fake.version);
      }
    }, 120);
  },

  reset: () => {
    if (previewTimer) clearInterval(previewTimer);
    previewTimer = null;
    void clearUpdateNotification();
    set({ phase: 'idle', info: null, progress: 0, error: null, open: false });
  },
}));
