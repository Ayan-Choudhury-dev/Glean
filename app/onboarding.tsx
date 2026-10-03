import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { theme, type AppColors } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

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
  height: 48,
  fontSize: theme.type.label,
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

export default function OnboardingScreen() {
  const { profile, signUp, signIn, signInWithMagicLink } = useGleanStore();
  const colors = useColors();
  const inputStyle = makeInputStyle(colors);
  const [mode, setMode] = useState<Mode>('sign_up');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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
      Alert.alert('Unable to continue', error);
      return;
    }

    const { profile: p } = useGleanStore.getState();
    router.replace(p?.house_id ? '/(tabs)' : '/house-setup');
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email.');
      return;
    }
    setBusy(true);
    const error = await signInWithMagicLink(email.trim());
    setBusy(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }
    setMagicLinkSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, paddingHorizontal: 32, justifyContent: 'center' }}>
        {/* App mark */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{ width: 80, height: 80, backgroundColor: colors.accent, borderRadius: theme.radii.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="cube" size={40} color={colors.surface} />
          </View>
          <Text style={{ fontSize: 30, fontWeight: '700', color: colors.text }}>Glean</Text>
          <Text style={{ color: colors.textFaint, fontSize: theme.type.label, marginTop: 4 }}>Your household inventory</Text>
        </View>

        {/* Mode toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: theme.radii.md, padding: 4, marginBottom: 24 }}>
          {(['sign_up', 'sign_in'] as Mode[]).map(m => {
            const active = mode === m;
            return (
              <Tappable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: theme.radii.sm,
                  alignItems: 'center',
                  backgroundColor: active ? colors.surface : 'transparent',
                  shadowColor: active ? colors.shadow : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: active ? 0.05 : 0,
                  shadowRadius: active ? 2 : 0,
                  elevation: active ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: active ? colors.accent : colors.textFaint }}>
                  {m === 'sign_up' ? 'Sign up' : 'Sign in'}
                </Text>
              </Tappable>
            );
          })}
        </View>

        <View style={{ gap: 16 }}>
          {mode === 'sign_up' && (
            <View>
              <TextInput
                style={[inputStyle, errors.name ? { borderColor: colors.dangerBorder } : { borderColor: colors.border }]}
                placeholder="Your name"
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={v => { setName(v); setErrors(p => ({ ...p, name: undefined })); }}
                onBlur={() => onBlurField('name', name)}
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
              />
              {errors.name && <FieldError message={errors.name} />}
            </View>
          )}

          <View>
            <TextInput
              style={[inputStyle, errors.email ? { borderColor: colors.dangerBorder } : { borderColor: colors.border }]}
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={v => { setEmail(v); setErrors(p => ({ ...p, email: undefined })); }}
              onBlur={() => onBlurField('email', email)}
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
            <View>
              <TextInput
                style={[inputStyle, { paddingRight: 48 }, errors.password ? { borderColor: colors.dangerBorder } : { borderColor: colors.border }]}
                placeholder="Password"
                placeholderTextColor={colors.textFaint}
                value={password}
                onChangeText={v => { setPassword(v); setErrors(p => ({ ...p, password: undefined })); }}
                onBlur={() => onBlurField('password', password)}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
                textContentType={mode === 'sign_up' ? 'newPassword' : 'password'}
              />
              <Tappable
                onPress={() => setShowPwd(v => !v)}
                hitSlop={12}
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
            style={{
              backgroundColor: colors.accent,
              borderRadius: theme.radii.md,
              height: 48,
              marginTop: 8,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy && <ActivityIndicator color={colors.surface} />}
            <Text style={{ color: colors.surface, fontSize: 15, fontWeight: '600' }}>
              {mode === 'sign_up' ? 'Create account' : 'Sign in'}
            </Text>
          </Tappable>

          {/* Magic link */}
          {!isExpoGo && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ marginHorizontal: 16, fontSize: theme.type.caption, color: colors.textFaint }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              {magicLinkSent ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Ionicons name="mail-outline" size={28} color={colors.textMuted} />
                  <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: colors.text, marginTop: 8 }}>Check your email</Text>
                  <Text style={{ fontSize: theme.type.caption, color: colors.textFaint, textAlign: 'center', marginTop: 4 }}>
                    We sent a sign-in link to {email}
                  </Text>
                  <Tappable onPress={() => setMagicLinkSent(false)}>
                    <Text style={{ fontSize: theme.type.caption, color: colors.info, marginTop: 4 }}>Use a different email</Text>
                  </Tappable>
                </View>
              ) : (
                <Tappable
                  onPress={handleMagicLink}
                  disabled={busy}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: theme.radii.md,
                    height: 48,
                  }}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                  <Text style={{ marginLeft: 8, fontSize: theme.type.label, fontWeight: '600', color: colors.text }}>
                    Sign in with magic link
                  </Text>
                </Tappable>
              )}
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
