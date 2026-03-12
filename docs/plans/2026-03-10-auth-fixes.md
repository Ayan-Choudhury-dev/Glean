# Auth Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken logout and add Google OAuth sign-in.

**Architecture:** Split `signOut` into Supabase call + local `clearSession()` to break the recursive loop. Replace `useRouter()` with expo-router's static `router` in onboarding. Add Google OAuth using `expo-auth-session` + `expo-web-browser` to open Supabase's OAuth flow in a system browser, handling the redirect back via the existing `glean://` deep link scheme.

**Tech Stack:** Expo Router, Supabase Auth, expo-auth-session, expo-web-browser, Zustand

---

### Task 1: Install OAuth dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
npx expo install expo-auth-session expo-web-browser expo-crypto
```

`expo-auth-session` handles OAuth redirect flows. `expo-web-browser` opens the system browser. `expo-crypto` is a peer dep required by expo-auth-session.

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-auth-session, expo-web-browser, expo-crypto"
```

---

### Task 2: Add `clearSession` to the store and fix `signOut`

**Files:**
- Modify: `store/useGleanStore.ts`

**Step 1: Add `clearSession` to the state interface**

In `store/useGleanStore.ts`, add `clearSession` to the `GleanState` interface, right after the `signOut` line:

```typescript
  signOut:      ()                                              => Promise<void>;
  clearSession: ()                                              => void;
```

**Step 2: Implement `clearSession` in the store body**

Add this right after the existing `signOut` implementation (after line 235):

```typescript
  clearSession: () => {
    set({ profile: null, house: null, inventory: [], shoppingList: [], consumptionLogs: [] });
  },
```

**Step 3: Update `signOut` to use `clearSession`**

Replace the existing `signOut` implementation:

```typescript
  // BEFORE:
  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, house: null, inventory: [], shoppingList: [], consumptionLogs: [] });
  },

  // AFTER:
  signOut: async () => {
    await supabase.auth.signOut();
    get().clearSession();
  },
```

**Step 4: Commit**

```bash
git add store/useGleanStore.ts
git commit -m "fix: split signOut into clearSession + supabase call to prevent recursive loop"
```

---

### Task 3: Fix the `onAuthStateChange` listener in `_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

**Step 1: Update the listener to use `clearSession`**

In `app/_layout.tsx`, change the destructured store values and the listener:

```typescript
  // BEFORE (line 38):
  const { loadSession, signOut } = useGleanStore();

  // AFTER:
  const { loadSession, clearSession } = useGleanStore();
```

```typescript
  // BEFORE (line 47-49):
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') signOut();
  });

  // AFTER:
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') clearSession();
  });
```

**Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "fix: use clearSession in auth listener to prevent recursive signOut loop"
```

---

### Task 4: Fix `useRouter()` crash in onboarding.tsx

**Files:**
- Modify: `app/onboarding.tsx`

**Step 1: Replace `useRouter()` with static router import**

In `app/onboarding.tsx`:

```typescript
  // BEFORE (line 3):
  import { useRouter } from 'expo-router';

  // AFTER:
  import { router } from 'expo-router';
```

**Step 2: Remove the `useRouter()` call**

```typescript
  // BEFORE (line 17):
  const router = useRouter();

  // DELETE this line entirely.
```

The rest of the file already uses `router.replace(...)` which works with the static import too.

**Step 3: Verify the app loads**

Run:
```bash
npx expo start
```

Open in Expo Go. Confirm the onboarding screen renders without a navigation context error.

**Step 4: Commit**

```bash
git add app/onboarding.tsx
git commit -m "fix: replace useRouter() with static router import to fix navigation context crash"
```

---

### Task 5: Add `signInWithGoogle` to the store

**Files:**
- Modify: `store/useGleanStore.ts`

**Step 1: Add `signInWithGoogle` to the state interface**

In the `GleanState` interface, after the `signIn` line:

```typescript
  signIn:           (email: string, password: string)               => Promise<string | null>;
  signInWithGoogle: ()                                              => Promise<string | null>;
```

**Step 2: Implement `signInWithGoogle`**

Add this after the `signIn` implementation (after line 231):

```typescript
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'glean://',
        skipBrowserRedirect: true,
      },
    });

    if (error) return error.message;
    if (!data.url) return 'Could not get Google sign-in URL.';

    // Open the OAuth URL in a system browser
    const WebBrowser = require('expo-web-browser');
    const result = await WebBrowser.openAuthSessionAsync(data.url, 'glean://');

    if (result.type !== 'success' || !result.url) {
      return result.type === 'cancel' ? null : 'Google sign-in failed.';
    }

    // Extract tokens from the redirect URL fragment
    const url = new URL(result.url);
    // Supabase puts tokens in the hash fragment: #access_token=...&refresh_token=...
    const params = new URLSearchParams(url.hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) return 'Missing tokens from Google sign-in.';

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) return sessionError.message;
    if (!sessionData.user) return 'Google sign-in failed.';

    // Load or create profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionData.user.id)
      .single();

    if (!profile) return 'Profile not found.';

    set({ profile });

    if (profile.house_id) {
      await get().loadHouseData(profile.house_id);
    }

    return null;
  },
```

**Step 3: Commit**

```bash
git add store/useGleanStore.ts
git commit -m "feat: add signInWithGoogle OAuth flow via expo-web-browser"
```

---

### Task 6: Add Google sign-in button to onboarding screen

**Files:**
- Modify: `app/onboarding.tsx`

**Step 1: Import `signInWithGoogle` from the store**

```typescript
  // BEFORE (line 16):
  const { profile, signUp, signIn } = useGleanStore();

  // AFTER:
  const { profile, signUp, signIn, signInWithGoogle } = useGleanStore();
```

**Step 2: Add the Google sign-in handler**

Add this right after the `handleSubmit` function (after line 59):

```typescript
  const handleGoogleSignIn = async () => {
    setBusy(true);
    const error = await signInWithGoogle();
    setBusy(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    const { profile: p } = useGleanStore.getState();
    router.replace(p?.house_id ? '/(tabs)' : '/house-setup');
  };
```

**Step 3: Add the Google button to the UI**

After the existing `<Button>` for sign-in/sign-up (after line 142), add a divider and Google button:

```tsx
          {/* Divider */}
          <HStack className="items-center my-2">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-4 text-xs text-gray-400">or</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </HStack>

          {/* Google sign-in */}
          <Pressable
            className="flex-row items-center justify-center bg-white border border-gray-200 rounded-xl h-12"
            onPress={handleGoogleSignIn}
            disabled={busy}
          >
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text className="ml-2 text-sm font-semibold text-gray-700">
              Continue with Google
            </Text>
          </Pressable>
```

**Step 4: Add `View` to the React Native import if not already there**

Line 2 already imports `View`, so no change needed.

**Step 5: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat: add Google sign-in button to onboarding screen"
```

---

### Task 7: Fix `useRouter()` in profile.tsx

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Step 1: Replace `useRouter()` with static router import**

```typescript
  // BEFORE (line 4):
  import { useRouter } from 'expo-router';

  // AFTER:
  import { router } from 'expo-router';
```

**Step 2: Remove the `useRouter()` call**

```typescript
  // BEFORE (line 15):
  const router = useRouter();

  // DELETE this line entirely.
```

**Step 3: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "fix: replace useRouter() with static router import in profile screen"
```

---

### Task 8: External configuration (manual — not code)

These steps must be done by the developer in browser dashboards:

**Step 1: Google Cloud Console**

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Go to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID (type: Web application)
5. Add authorized redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
6. Copy the **Client ID** and **Client Secret**

**Step 2: Supabase Dashboard**

1. Go to your Supabase project > Authentication > Providers
2. Enable Google
3. Paste the Client ID and Client Secret from step 1
4. Save

**Step 3: Verify end-to-end**

1. Run app in Expo Go: `npx expo start`
2. Tap "Continue with Google"
3. Sign in with Google account
4. Confirm you land on house-setup (new user) or tabs (existing user)
5. Navigate to settings tab > tap Sign out
6. Confirm you return to onboarding screen

---

## Summary of all changes

| File | Change |
|------|--------|
| `package.json` | Add expo-auth-session, expo-web-browser, expo-crypto |
| `store/useGleanStore.ts` | Add `clearSession()`, refactor `signOut()`, add `signInWithGoogle()` |
| `app/_layout.tsx` | Use `clearSession` in auth listener |
| `app/onboarding.tsx` | Static `router` import, add Google sign-in button + handler |
| `app/(tabs)/profile.tsx` | Static `router` import |
