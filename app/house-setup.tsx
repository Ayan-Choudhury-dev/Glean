import React, { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { theme } from '@/constants/theme';
import { FEATURES } from '@/constants/config';
import { useColors } from '@/lib/appearance';
import { showDialog } from '@/lib/overlay';

type Mode = 'pick' | 'create';

export default function HouseSetupScreen() {
  const { profile, createHouse, signOut } = useGleanStore();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('pick');
  const [houseName, setHouseName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (busy || !houseName.trim()) return;
    setBusy(true);
    const result = await createHouse(houseName.trim());
    setBusy(false);

    if (typeof result === 'string') {
      showDialog({ title: 'Could not create', message: result, cancelLabel: null });
      return;
    }

    router.replace('/(tabs)');
  };

  const handleSignOut = () => {
    showDialog({
      title: 'Log out',
      message: 'You can set up or join a household again after signing back in.',
      confirmLabel: 'Log out',
      destructive: true,
      onConfirm: async () => {
        await signOut();
        router.replace('/onboarding');
      },
    });
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
        {mode === 'pick' && (
          <>
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <View style={{ width: 64, height: 64, borderRadius: theme.radii.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="home-outline" size={30} color={colors.accent} />
              </View>
              <Text style={{ fontSize: theme.type.xxl, color: colors.text, fontFamily: theme.fonts.displayBold, textAlign: 'center' }}>
                Set up your household
              </Text>
              <Text style={{ fontSize: theme.type.label, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
                Hi {profile?.name ?? 'there'} — set up your home to get started.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <OptionCard
                icon="add-circle-outline"
                title="Create a house"
                subtitle="Start tracking your pantry"
                onPress={() => setMode('create')}
              />
            </View>

            <Tappable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              style={{ alignSelf: 'center', marginTop: 32, paddingVertical: 12, paddingHorizontal: 20 }}
            >
              <Text style={{ fontSize: theme.type.label, color: colors.textMuted, fontFamily: theme.fonts.medium }}>
                Log out
              </Text>
            </Tappable>
          </>
        )}

        {mode === 'create' && (
          <>
            <BackButton onPress={() => setMode('pick')} />
            <Text style={{ fontSize: theme.type.heading, color: colors.text, fontFamily: theme.fonts.display, marginTop: 16, marginBottom: 6 }}>
              Name your household
            </Text>
            <Text style={{ fontSize: theme.type.label, color: colors.textMuted, marginBottom: 24 }}>
              You can change this later in settings.
            </Text>

            <Field
              label="Household name"
              value={houseName}
              onChangeText={setHouseName}
              placeholder="e.g. The Choudhury Home"
              autoFocus
              accessibilityLabel="Household name"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <PrimaryButton label={busy ? 'Creating…' : 'Create house'} onPress={handleCreate} disabled={busy || !houseName.trim()} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  inputStyle,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  inputStyle?: object;
} & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'placeholder' | 'style'>) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginBottom: 6, marginLeft: 4 }}>
        {label}
      </Text>
      <TextInput
      style={[
        {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: focused ? colors.accent : colors.border,
          borderRadius: theme.radii.md,
          paddingHorizontal: 16,
          height: 52,
          fontSize: theme.type.body,
          color: colors.text,
          fontFamily: theme.fonts.regular,
        },
        inputStyle,
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      autoCorrect={false}
      {...rest}
    />
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ backgroundColor: colors.accent, borderRadius: theme.radii.md, minHeight: 52, marginTop: 16, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ color: colors.onAccent, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>{label}</Text>
    </Tappable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 10, paddingRight: 12 }}
    >
      <Ionicons name="arrow-back" size={18} color={colors.textMuted} />
      <Text style={{ fontSize: theme.type.label, color: colors.textMuted }}>Back</Text>
    </Tappable>
  );
}

function OptionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <View style={{ width: 44, height: 44, borderRadius: theme.radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: theme.type.body, color: colors.text, fontFamily: theme.fonts.medium }}>{title}</Text>
        <Text style={{ fontSize: theme.type.caption, color: colors.textMuted, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
    </Tappable>
  );
}
