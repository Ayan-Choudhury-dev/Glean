import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// Ensure the auth redirect is consumed when this module loads (Android custom tab).
WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Google Drive app-data folder — backup files live hidden from the user's Drive UI. */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** True once the Cloud Console client IDs are provided in .env / EAS env. */
export const googleAuthConfigured = Boolean(ANDROID_CLIENT_ID && WEB_CLIENT_ID);

export interface GoogleAuthTokens {
  /** Identity token (for login / Supabase). */
  idToken: string | null;
  /** Access token (for the Google Drive API). */
  accessToken: string | null;
  /** Refresh token (persist for long-lived Drive access). */
  refreshToken: string | null;
}

/**
 * Google OAuth prompt: identity (openid/email/profile) + Drive backup scope.
 * Returns the standard expo-auth-session tuple — call `promptAsync()` on a tap.
 */
export function useGoogleAuth() {
  return Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'email', 'profile', DRIVE_APPDATA_SCOPE],
  });
}

/** Pull the tokens out of a successful auth response. */
export function tokensFromResponse(response: {
  type?: string | null;
  authentication?: { idToken?: string; accessToken?: string; refreshToken?: string } | null;
}): GoogleAuthTokens {
  if (response.type !== 'success' || !response.authentication) {
    return { idToken: null, accessToken: null, refreshToken: null };
  }
  return {
    idToken: response.authentication.idToken ?? null,
    accessToken: response.authentication.accessToken ?? null,
    refreshToken: response.authentication.refreshToken ?? null,
  };
}
