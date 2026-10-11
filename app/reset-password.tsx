import React, { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { showDialog, showToast } from '@/lib/overlay';

export default function ResetPasswordScreen() {
  const { profile, updatePassword } = useGleanStore();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'password' | 'confirm' | null>(null);

  const handleSave = async () => {
    if (busy) return;
    if (password.length < 6) {
      showDialog({ title: 'Password too short', message: 'Use at least 6 characters.', cancelLabel: null });
      return;
    }
    if (password !== confirm) {
      showDialog({ title: "Passwords don't match", message: 'Enter the same password twice.', cancelLabel: null });
      return;
    }

    setBusy(true);
    const error = await updatePassword(password);
    setBusy(false);

    if (error) {
      showDialog({ title: "Couldn't update password", message: error, cancelLabel: null });
      return;
    }

    showToast('Password updated');
    const p = useGleanStore.getState().profile;
    router.replace(p?.house_id ? '/(tabs)' : '/house-setup');
  };

  const inputStyle = (field: 'password' | 'confirm') => ({
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: focused === field ? colors.accent : colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 16,
    height: 52,
    fontSize: theme.type.body,
    color: colors.text,
    fontFamily: theme.fonts.regular,
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      >
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: theme.radii.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.accent} />
          </View>
          <Text style={{ fontSize: theme.type.heading, color: colors.text, fontFamily: theme.fonts.display, textAlign: 'center' }}>
            Set a new password
          </Text>
          <Text style={{ fontSize: theme.type.label, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
            {profile?.name ? `For ${profile.name}'s account` : 'Choose a new password for your account'}
          </Text>
        </View>

        <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginBottom: 6, marginLeft: 4 }}>New password</Text>
        <TextInput
          style={inputStyle('password')}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textFaint}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginTop: 16, marginBottom: 6, marginLeft: 4 }}>Confirm password</Text>
        <TextInput
          style={inputStyle('confirm')}
          placeholder="Re-enter password"
          placeholderTextColor={colors.textFaint}
          value={confirm}
          onChangeText={setConfirm}
          onFocus={() => setFocused('confirm')}
          onBlur={() => setFocused(null)}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Tappable
          onPress={handleSave}
          disabled={busy || !password || !confirm}
          accessibilityRole="button"
          accessibilityLabel="Save new password"
          style={{ backgroundColor: colors.accent, borderRadius: theme.radii.md, minHeight: 52, marginTop: 24, alignItems: 'center', justifyContent: 'center', opacity: busy || !password || !confirm ? 0.5 : 1 }}
        >
          <Text style={{ color: colors.onAccent, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>
            {busy ? 'Saving…' : 'Save password'}
          </Text>
        </Tappable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
