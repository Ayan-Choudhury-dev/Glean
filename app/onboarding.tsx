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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { theme, type AppColors } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { showDialog } from '@/lib/overlay';

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
  const { profile, signUp } = useGleanStore();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputStyle = makeInputStyle(colors);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // Already set up — skip onboarding.
  useEffect(() => {
    if (profile) {
      router.replace(profile.house_id ? '/(tabs)' : '/house-setup');
    }
  }, [profile]);

  if (profile) return null;

  const handleStart = async () => {
    if (!name.trim()) {
      showDialog({ title: 'Your name', message: 'Please enter your name to get started.', cancelLabel: null });
      return;
    }
    setBusy(true);
    const error = await signUp(name.trim());
    setBusy(false);
    if (error) {
      showDialog({ title: 'Unable to continue', message: error, cancelLabel: null });
      return;
    }
    router.replace('/house-setup');
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

        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginBottom: 6, marginLeft: 4 }}>
              Your name
            </Text>
            <TextInput
              style={[inputStyle, { borderColor: colors.border }]}
              placeholder="e.g. Ayan"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoCorrect={false}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="go"
              onSubmitEditing={handleStart}
            />
          </View>

          <Tappable
            onPress={handleStart}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel="Get started"
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
              Get started
            </Text>
          </Tappable>

          <Text style={{ color: colors.textFaint, fontSize: theme.type.caption, textAlign: 'center', marginTop: 4 }}>
            Your pantry lives on this device. No account needed.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
