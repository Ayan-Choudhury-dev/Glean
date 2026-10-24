import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { theme, type AppColors } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { showDialog, showToast } from '@/lib/overlay';
import { useGoogleAuth, tokensFromResponse, googleAuthConfigured } from '../lib/googleAuth';

type Mode = 'sign_up' | 'sign_in';

type FieldErrors = { name?: string; email?: string; password?: string };

// Magic links redirect to the `glean://` custom scheme, which Expo Go can't
// handle — they only work in a dev/standalone build.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const makeInputStyle = (colors: AppColors) => ({
  backgroundColor: colors.surfaceMuted,
  borderWidth: 1,
  borderRadius: theme.radii.md,
  paddingHorizontal: 16,
  height: 52,
  fontSize: theme.type.body,
  color: colors.text,
  fontFamily: theme.fonts.regular,
});

function FieldError({ message }: { message: string }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.danger, fontSize: theme.type.caption, marginTop: 4, marginLeft: 4 }}>
      {message}
    </Text>
  );
}

function FormLabel({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginBottom: 6, marginLeft: 4 }}>
      {text}
    </Text>
  );
}

// Hero: the app's own category art, arranged like a stocked shelf and animated
// in on mount (staggered rise + scale + fade) to sell the pantry concept.
const HERO_GROCERIES = [
  { src: require('../assets/images/categories/vegetables.png'), size: 62, offset: 0 },
  { src: require('../assets/images/categories/dairy.png'),      size: 54, offset: 18 },
  { src: require('../assets/images/categories/fruits.png'),     size: 58, offset: 4 },
  { src: require('../assets/images/categories/grains.png'),     size: 54, offset: 18 },
  { src: require('../assets/images/categories/spices.png'),     size: 62, offset: 0 },
] as const;

function GroceryHero() {
  const anims = React.useRef(HERO_GROCERIES.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    Animated.stagger(
      90,
      anims.map(a => Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7, tension: 70 })),
    ).start();
  }, [anims]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, marginTop: 22 }}>
      {HERO_GROCERIES.map((g, i) => (
        <View key={i} style={{ marginTop: g.offset }}>
          <Animated.Image
            source={g.src}
            resizeMode="contain"
            style={{
              width: g.size,
              height: g.size,
              opacity: anims[i],
              transform: [
                { translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                { scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            }}
          />
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const { profile, signUp, signIn, signInWithMagicLink, sendPasswordReset } = useGleanStore();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputStyle = makeInputStyle(colors);
  const [mode, setMode] = useState<Mode>('sign_up');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [focused, setFocused] = useState<keyof FieldErrors | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [googleRequest, , googlePrompt] = useGoogleAuth();

  // Already authenticated — skip onboarding
  useEffect(() => {
    if (profile) {
      router.replace(profile.house_id ? '/(tabs)' : '/house-setup');
    }
  }, [profile]);

  if (profile) return null;

  const validateField = (field: keyof FieldErrors, value: string): string | undefined => {
    if (field === 'name' && mode === 'sign_up' && !value.trim()) {
      return 'Please enter your name.';
    }
    if (field === 'email') {
      if (!value.trim()) return 'Please enter your email.';
      if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
    }
    if (field === 'password') {
      if (!value) return 'Please enter a password.';
      if (value.length < 6) return 'Use at least 6 characters.';
    }
    return undefined;
  };

  const onBlurField = (field: keyof FieldErrors, value: string) => {
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const validateAll = (): boolean => {
    const next: FieldErrors = {
      name: validateField('name', name),
      email: validateField('email', email),
      password: validateField('password', password),
    };
    setErrors(next);
    return !next.name && !next.email && !next.password;
  };

  const handleSubmit = async () => {
    if (!validateAll()) return;

    setBusy(true);
    const error =
      mode === 'sign_up'
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);
    setBusy(false);

    if (error) {
      showDialog({ title: 'Unable to continue', message: error, cancelLabel: null });
      return;
    }

    const { profile: p } = useGleanStore.getState();
    router.replace(p?.house_id ? '/(tabs)' : '/house-setup');
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      showDialog({ title: 'Required', message: 'Please enter your email.', cancelLabel: null });
      return;
    }
    setBusy(true);
    const error = await signInWithMagicLink(email.trim());
    setBusy(false);

    if (error) {
      showDialog({ title: 'Error', message: error, cancelLabel: null });
      return;
    }
    setMagicLinkSent(true);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showDialog({ title: 'Enter your email', message: 'Type your email above, then tap Forgot password.', cancelLabel: null });
      return;
    }
    setBusy(true);
    const error = await sendPasswordReset(email.trim());
    setBusy(false);
    if (error) {
      showDialog({ title: "Couldn't send reset link", message: error, cancelLabel: null });
      return;
    }
    showToast('Reset link sent — check your email');
  };

  const handleGoogleSignIn = async () => {
    if (!googleRequest) return;
    setBusy(true);
    try {
      const result = await googlePrompt();
      if (result?.type !== 'success' || !result.authentication) {
        if (result?.type === 'error') {
          showDialog({ title: 'Google sign-in failed', message: result.error?.message ?? 'Please try again.', cancelLabel: null });
        }
        return;
      }
      const { idToken, accessToken } = tokensFromResponse(result);

      // Round-trip proof: use the Drive-capable access token to read identity.
      let email: string | undefined;
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) email = (await res.json()).email;
      } catch {
        /* identity fetch is best-effort */
      }

      // TODO: hand idToken to auth (Supabase signInWithIdToken) / accessToken to Drive backup.
      console.log('[google] tokens', { idToken: !!idToken, accessToken: !!accessToken, email });
      showToast(email ? `Google connected — ${email}` : 'Google connected');
    } catch (e) {
      showDialog({ title: 'Google sign-in failed', message: String(e), cancelLabel: null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      >
        {/* Brand hero */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Text style={{ fontSize: 44, color: colors.text, fontFamily: theme.fonts.displayBold, letterSpacing: -0.5 }}>
            Glean
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: theme.type.md, marginTop: 6, textAlign: 'center' }}>
            Know what's in your pantry — never run out.
          </Text>
          <GroceryHero />
        </View>

        {/* Mode toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: theme.radii.md, padding: 4, marginBottom: 24 }}>
          {(['sign_up', 'sign_in'] as Mode[]).map(m => {
            const active = mode === m;
            return (
              <Tappable
                key={m}
                onPress={() => setMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m === 'sign_up' ? 'Sign up' : 'Sign in'}
                style={{
                  flex: 1,
                  minHeight: 44,
                  paddingVertical: 8,
                  borderRadius: theme.radii.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.surface : 'transparent',
                  shadowColor: active ? colors.shadow : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: active ? 0.05 : 0,
                  shadowRadius: active ? 2 : 0,
                  elevation: active ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: theme.type.label, fontFamily: active ? theme.fonts.medium : theme.fonts.regular, color: active ? colors.accent : colors.textFaint }}>
                  {m === 'sign_up' ? 'Sign up' : 'Sign in'}
                </Text>
              </Tappable>
            );
          })}
        </View>

        <View style={{ gap: 16 }}>
          {mode === 'sign_up' && (
            <View>
              <FormLabel text="Name" />
              <TextInput
                style={[inputStyle, errors.name ? { borderColor: colors.dangerBorder } : focused === 'name' ? { borderColor: colors.accent } : { borderColor: colors.border }]}
                placeholder="Your name"
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={v => { setName(v); setErrors(p => ({ ...p, name: undefined })); }}
                onFocus={() => setFocused('name')}
                onBlur={() => { setFocused(null); onBlurField('name', name); }}
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
              />
              {errors.name && <FieldError message={errors.name} />}
            </View>
          )}

          <View>
            <FormLabel text="Email" />
            <TextInput
              style={[inputStyle, errors.email ? { borderColor: colors.dangerBorder } : focused === 'email' ? { borderColor: colors.accent } : { borderColor: colors.border }]}
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={v => { setEmail(v); setErrors(p => ({ ...p, email: undefined })); }}
              onFocus={() => setFocused('email')}
              onBlur={() => { setFocused(null); onBlurField('email', email); }}
              inputMode="email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
            {errors.email && <FieldError message={errors.email} />}
          </View>

          <View>
            <FormLabel text="Password" />
            <View>
              <TextInput
                style={[inputStyle, { paddingRight: 48 }, errors.password ? { borderColor: colors.dangerBorder } : focused === 'password' ? { borderColor: colors.accent } : { borderColor: colors.border }]}
                placeholder="Password"
                placeholderTextColor={colors.textFaint}
                value={password}
                onChangeText={v => { setPassword(v); setErrors(p => ({ ...p, password: undefined })); }}
                onFocus={() => setFocused('password')}
                onBlur={() => { setFocused(null); onBlurField('password', password); }}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
                textContentType={mode === 'sign_up' ? 'newPassword' : 'password'}
              />
              <Tappable
                onPress={() => setShowPwd(v => !v)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={showPwd ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 16, top: 12 }}
              >
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textFaint} />
              </Tappable>
            </View>
            {errors.password && <FieldError message={errors.password} />}
          </View>

          <Tappable
            onPress={handleSubmit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel={mode === 'sign_up' ? 'Create account' : 'Sign in'}
            style={{
              backgroundColor: colors.accent,
              borderRadius: theme.radii.md,
              minHeight: 48,
              marginTop: 8,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy && <ActivityIndicator color={colors.onAccent} />}
            <Text style={{ color: colors.onAccent, fontSize: theme.type.md, fontFamily: theme.fonts.medium }}>
              {mode === 'sign_up' ? 'Create account' : 'Sign in'}
            </Text>
          </Tappable>

          {mode === 'sign_in' && (
            <Tappable
              onPress={handleForgotPassword}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 8 }}
            >
              <Text style={{ fontSize: theme.type.label, color: colors.accent, fontFamily: theme.fonts.medium }}>
                Forgot password?
              </Text>
            </Tappable>
          )}

          {/* Magic link */}
          {!isExpoGo && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ marginHorizontal: 16, fontSize: theme.type.caption, color: colors.textFaint }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              {googleAuthConfigured && (
                <Tappable
                  onPress={handleGoogleSignIn}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  accessibilityLabel="Continue with Google"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: theme.radii.md,
                    minHeight: 48,
                    gap: 8,
                  }}
                >
                  <Ionicons name="logo-google" size={18} color={colors.text} />
                  <Text style={{ fontSize: theme.type.label, fontFamily: theme.fonts.medium, color: colors.text }}>
                    Continue with Google
                  </Text>
                </Tappable>
              )}

              {magicLinkSent ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Ionicons name="mail-outline" size={28} color={colors.textMuted} />
                  <Text style={{ fontSize: theme.type.label, fontFamily: theme.fonts.medium, color: colors.text, marginTop: 8 }}>Check your email</Text>
                  <Text style={{ fontSize: theme.type.caption, color: colors.textFaint, textAlign: 'center', marginTop: 4 }}>
                    We sent a sign-in link to {email}
                  </Text>
                  <Tappable onPress={() => setMagicLinkSent(false)} accessibilityRole="button" accessibilityLabel="Use a different email">
                    <Text style={{ fontSize: theme.type.caption, color: colors.info, marginTop: 4 }}>Use a different email</Text>
                  </Tappable>
                </View>
              ) : (
                <Tappable
                  onPress={handleMagicLink}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  accessibilityLabel="Sign in with magic link"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: theme.radii.md,
                    minHeight: 48,
                  }}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                  <Text style={{ marginLeft: 8, fontSize: theme.type.label, fontFamily: theme.fonts.medium, color: colors.text }}>
                    Sign in with magic link
                  </Text>
                </Tappable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
