import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Last-known profile, persisted so a cold start with no network still lands the
 * signed-in user in the app instead of the login screen. `loadSession` falls
 * back to this when the profile fetch fails.
 */
const KEY = 'glean:profile-cache';

export async function saveProfile(profile: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Best-effort cache — never block on it.
  }
}

export async function loadProfile<T>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function clearProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
