# Auth Fixes Design — 2026-03-10

## Problem Statement
1. The logout button in the settings tab doesn't work
2. Google OAuth is not set up for easy logins

## Root Causes (Logout)

### A. `useRouter()` crash on mount
`onboarding.tsx` calls `useRouter()` before Expo Router's navigation context is ready, causing a render error on mobile (Expo Go).

**Fix:** Replace `useRouter()` with expo-router's static `router` import or `Redirect` component.

### B. Recursive signOut loop
`_layout.tsx` has an `onAuthStateChange` listener that calls `signOut()` on `SIGNED_OUT` events. But `signOut()` calls `supabase.auth.signOut()`, which fires another `SIGNED_OUT` event — infinite loop.

**Fix:** Split into `clearSession()` (local state reset only) and `signOut()` (calls Supabase + clearSession). The listener uses `clearSession()`.

### C. `Alert.alert` no-op on web
Not addressing now — targeting mobile via Expo Go. Revisit if web support needed.

## Google OAuth Design

### Approach
Use Supabase's built-in Google OAuth provider with `expo-auth-session` + `expo-web-browser` for the native redirect flow.

### External Setup Required
1. Google Cloud Console: Create OAuth 2.0 credentials (web application type)
   - Authorized redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
2. Supabase Dashboard: Enable Google provider under Authentication > Providers
   - Paste Google Client ID and Client Secret

### Code Changes
- `store/useGleanStore.ts` — add `clearSession()`, add `signInWithGoogle()` method
- `app/_layout.tsx` — auth listener uses `clearSession()` instead of `signOut()`
- `app/onboarding.tsx` — fix `useRouter()`, add "Continue with Google" button
- `package.json` — add `expo-auth-session`, `expo-web-browser`

### OAuth Flow
1. User taps "Continue with Google"
2. App calls `supabase.auth.signInWithOAuth({ provider: 'google' })` to get the auth URL
3. Opens URL in system browser via `expo-web-browser`
4. User authenticates with Google → redirects to Supabase callback
5. Supabase redirects back to app via deep link (`glean://`)
6. App handles the URL, extracts session, and routes to house-setup or tabs

## Files Changed
- `store/useGleanStore.ts`
- `app/_layout.tsx`
- `app/onboarding.tsx`
- `package.json`
