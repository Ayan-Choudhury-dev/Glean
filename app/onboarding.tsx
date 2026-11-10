import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { showDialog } from '@/lib/overlay';
import { saveServerConfig } from '@/lib/serverConfig';
import { initSupabase, testConnection } from '@/lib/supabase';

type Step = 'welcome' | 'name' | 'staples' | 'where';

const STAPLES: { name: string; category: string; location: string }[] = [
  { name: 'Milk',      category: 'Dairy',      location: 'Fridge' },
  { name: 'Eggs',      category: 'Dairy',      location: 'Fridge' },
  { name: 'Butter',    category: 'Dairy',      location: 'Fridge' },
  { name: 'Bread',     category: 'Grains',     location: 'Pantry' },
  { name: 'Rice',      category: 'Grains',     location: 'Pantry' },
  { name: 'Pasta',     category: 'Grains',     location: 'Pantry' },
  { name: 'Coffee',    category: 'Beverages',  location: 'Pantry' },
  { name: 'Tea',       category: 'Beverages',  location: 'Pantry' },
  { name: 'Tomatoes',  category: 'Vegetables', location: 'Fridge' },
  { name: 'Onions',    category: 'Vegetables', location: 'Pantry' },
  { name: 'Bananas',   category: 'Fruits',     location: 'Counter' },
  { name: 'Apples',    category: 'Fruits',     location: 'Fridge' },
];

const VALUE_POINTS: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'basket-outline', text: 'Know what you already have' },
  { icon: 'alert-circle-outline', text: 'See what is running low' },
  { icon: 'cart-outline', text: 'Build a shopping list in seconds' },
];

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
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, marginTop: 20 }}>
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
  const { profile, signUp, createHouse, addInventoryItem } = useGleanStore();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [serverMode, setServerMode] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [busy, setBusy] = useState(false);

  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, enter]);

  useEffect(() => {
    if (profile) router.replace(profile.house_id ? '/(tabs)' : '/house-setup');
  }, [profile]);

  if (profile) return null;

  const toggle = (stapleName: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(stapleName)) next.delete(stapleName);
      else next.add(stapleName);
      return next;
    });
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const server = serverMode
        ? { url: serverUrl.trim(), anonKey: serverKey.trim() }
        : null;
      if (server) {
        if (!server.url || !server.anonKey) {
          showDialog({ title: 'Server details', message: 'Enter your server URL and anon key.', cancelLabel: null });
          return;
        }
        const err = await testConnection(server);
        if (err) {
          showDialog({ title: 'Could not reach the server', message: err, cancelLabel: null });
          return;
        }
      }

      const error = await signUp(name.trim());
      if (error) {
        showDialog({ title: 'Unable to continue', message: error, cancelLabel: null });
        return;
      }

      const { profile: p } = useGleanStore.getState();
      let houseId = p?.house_id ?? null;
      if (p && !houseId) {
        const created = await createHouse('My Pantry');
        if (typeof created === 'string') {
          showDialog({ title: 'Could not create pantry', message: created, cancelLabel: null });
          return;
        }
        houseId = created.id;
      }

      STAPLES.forEach(staple => {
        if (picked.has(staple.name)) {
          addInventoryItem({ name: staple.name, qty: 1, category: staple.category, location: staple.location });
        }
      });

      if (server) {
        await saveServerConfig(server);
        initSupabase(server);
        await useGleanStore.getState().syncNow();
      }

      router.replace('/(tabs)');
    } catch (e) {
      showDialog({ title: 'Something went wrong', message: e instanceof Error ? e.message : String(e), cancelLabel: null });
    } finally {
      setBusy(false);
    }
  };

  const order: Step[] = ['welcome', 'name', 'staples', 'where'];
  const stepIndex = order.indexOf(step);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 28,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {order.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === stepIndex ? 22 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i <= stepIndex ? colors.accent : colors.border,
              }}
            />
          ))}
        </View>

        <Animated.View
          style={{
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        >
          {step === 'welcome' && (
            <View>
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 40, color: colors.text, fontFamily: theme.fonts.displayBold, letterSpacing: -0.5, textAlign: 'center' }}>
                  Your kitchen, remembered.
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: theme.type.md, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
                  Glean keeps track of what you have, so you shop once and stop running out.
                </Text>
                <GroceryHero />
              </View>

              <View style={{ gap: 14, marginTop: 28 }}>
                {VALUE_POINTS.map(point => (
                  <View key={point.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 40, height: 40, borderRadius: theme.radii.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={point.icon} size={20} color={colors.accent} />
                    </View>
                    <Text style={{ flex: 1, color: colors.text, fontSize: theme.type.body, lineHeight: 22 }}>
                      {point.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === 'name' && (
            <View>
              <Text style={{ fontSize: 30, color: colors.text, fontFamily: theme.fonts.displayBold, letterSpacing: -0.4 }}>
                What should we call you?
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.md, marginTop: 8, marginBottom: 24, lineHeight: 22 }}>
                Just a first name is fine. It stays on this device.
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radii.md,
                  paddingHorizontal: 16,
                  height: 56,
                  fontSize: theme.type.body,
                  color: colors.text,
                  fontFamily: theme.fonts.regular,
                }}
                placeholder="Your name"
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={setName}
                autoFocus
                autoCorrect={false}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => { if (name.trim()) setStep('staples'); }}
              />
            </View>
          )}

          {step === 'staples' && (
            <View>
              <Text style={{ fontSize: 30, color: colors.text, fontFamily: theme.fonts.displayBold, letterSpacing: -0.4 }}>
                What is usually in your kitchen?
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.md, marginTop: 8, marginBottom: 24, lineHeight: 22 }}>
                Tap a few staples to start your pantry. You can add anything else later.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {STAPLES.map(staple => {
                  const on = picked.has(staple.name);
                  return (
                    <Tappable
                      key={staple.name}
                      onPress={() => toggle(staple.name)}
                      haptic
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={staple.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        minHeight: 46,
                        paddingHorizontal: 15,
                        borderRadius: theme.radii.pill,
                        borderWidth: 1.5,
                        borderColor: on ? colors.accent : colors.border,
                        backgroundColor: on ? colors.accentSoft : colors.surface,
                      }}
                    >
                      <Ionicons
                        name={on ? 'checkmark-circle' : 'add-circle-outline'}
                        size={18}
                        color={on ? colors.accent : colors.textMuted}
                      />
                      <Text style={{ fontSize: theme.type.label, fontFamily: theme.fonts.medium, color: on ? colors.accent : colors.text }}>
                        {staple.name}
                      </Text>
                    </Tappable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'where' && (
            <View>
              <Text style={{ fontSize: 30, color: colors.text, fontFamily: theme.fonts.displayBold, letterSpacing: -0.4 }}>
                Where should your pantry live?
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.md, marginTop: 8, marginBottom: 20, lineHeight: 22 }}>
                Glean works on this device. You can also sync through a server you host yourself.
              </Text>

              <View style={{ gap: 12 }}>
                <OptionCard
                  selected={!serverMode}
                  icon="phone-portrait-outline"
                  title="On this device"
                  subtitle="Private, works offline, nothing to set up"
                  onPress={() => setServerMode(false)}
                />
                <OptionCard
                  selected={serverMode}
                  icon="server-outline"
                  title="My own server"
                  subtitle="Sync across devices through a server you run"
                  onPress={() => setServerMode(true)}
                />
              </View>

              {serverMode && (
                <View style={{ gap: 12, marginTop: 16 }}>
                  <TextInput
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: theme.radii.md,
                      paddingHorizontal: 16,
                      height: 52,
                      fontSize: theme.type.body,
                      color: colors.text,
                      fontFamily: theme.fonts.regular,
                    }}
                    placeholder="http://my-server:8000"
                    placeholderTextColor={colors.textFaint}
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <TextInput
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: theme.radii.md,
                      paddingHorizontal: 16,
                      height: 52,
                      fontSize: theme.type.body,
                      color: colors.text,
                      fontFamily: theme.fonts.regular,
                    }}
                    placeholder="Anon key (any non-empty value)"
                    placeholderTextColor={colors.textFaint}
                    value={serverKey}
                    onChangeText={setServerKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={{ color: colors.textFaint, fontSize: theme.type.caption, lineHeight: 18 }}>
                    Run the bundled backend first — see backend/README.md.
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        <View style={{ gap: 10, marginTop: 32 }}>
          {step === 'welcome' && (
            <PrimaryButton label="Get started" onPress={() => setStep('name')} />
          )}

          {step === 'name' && (
            <>
              <PrimaryButton label="Continue" onPress={() => setStep('staples')} disabled={!name.trim()} />
              <SecondaryButton label="Back" onPress={() => setStep('welcome')} />
            </>
          )}

          {step === 'staples' && (
            <>
              <PrimaryButton
                label={picked.size > 0 ? `Add ${picked.size} ${picked.size === 1 ? 'item' : 'items'}` : 'Add items'}
                onPress={() => setStep('where')}
                disabled={picked.size === 0}
              />
              <SecondaryButton label="Skip for now" onPress={() => setStep('where')} />
            </>
          )}

          {step === 'where' && (
            <>
              <PrimaryButton
                label={serverMode ? 'Connect & finish' : 'Finish setup'}
                onPress={finish}
                disabled={busy || (serverMode && (!serverUrl.trim() || !serverKey.trim()))}
                busy={busy}
              />
              <SecondaryButton label="Back" onPress={() => setStep('staples')} disabled={busy} />
            </>
          )}
        </View>

        <Text style={{ color: colors.textFaint, fontSize: theme.type.caption, textAlign: 'center', marginTop: 20, lineHeight: 18 }}>
          Your pantry lives on this device. No account needed.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OptionCard({
  selected,
  icon,
  title,
  subtitle,
  onPress,
}: {
  selected: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: theme.radii.lg,
        borderWidth: 1.5,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accentSoft : colors.surface,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: theme.radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={selected ? colors.accent : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: theme.type.body, color: colors.text, fontFamily: theme.fonts.medium }}>{title}</Text>
        <Text style={{ fontSize: theme.type.caption, color: colors.textMuted, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selected ? colors.accent : colors.border} />
    </Tappable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      haptic
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      style={{
        backgroundColor: colors.accent,
        borderRadius: theme.radii.md,
        minHeight: 54,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {busy && <ActivityIndicator color={colors.onAccent} />}
      <Text style={{ color: colors.onAccent, fontSize: theme.type.md, fontFamily: theme.fonts.medium }}>
        {label}
      </Text>
    </Tappable>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: 46, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ color: colors.textMuted, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>
        {label}
      </Text>
    </Tappable>
  );
}
