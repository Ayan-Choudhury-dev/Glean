import Constants from 'expo-constants';

// Lightweight self-update check against GitHub releases (no store, no account).
// The app is distributed as an APK from GitHub, so the latest release tag is the
// source of truth.

const REPO = 'Ayan-Choudhury-dev/Glean';
const RELEASES = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface UpdateInfo {
  version: string;
  url: string;
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

/** Returns the newer release when one exists, else null. Never throws. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(RELEASES, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = String(data.tag_name ?? '').replace(/^v/, '');
    if (!latest) return null;
    if (compareVersions(latest, currentVersion()) <= 0) return null;
    return {
      version: latest,
      url: data.html_url ?? `https://github.com/${REPO}/releases/latest`,
    };
  } catch {
    return null;
  }
}
