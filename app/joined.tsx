import React from 'react';
import { View, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { HouseAvatar } from '../components/HouseAvatar';
import { MemberStack } from '../components/MemberStack';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { initialsFor } from '@/lib/initials';

export default function JoinedScreen() {
  const { house, profile } = useGleanStore();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const members = house?.members ?? [];
  const others = members.filter(m => m.id !== profile?.id);
  const count = members.length;

  const go = () => router.replace('/(tabs)');

  if (!house) {
    router.replace('/house-setup');
    return null;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <HouseAvatar imageKey={house.image_key} size={88} radius={theme.radii.xl} />
        <Text style={{ fontSize: theme.type.xxl, color: colors.text, fontFamily: theme.fonts.displayBold, textAlign: 'center', marginTop: 16 }}>
          You joined {house.name}
        </Text>
        <Text style={{ fontSize: theme.type.label, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
          {count === 1
            ? "You're the first one here."
            : `You're now one of ${count} members.`}
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <MemberStack members={members} size={40} max={8} />
      </View>

      {others.length > 0 && (
        <View style={{ backgroundColor: colors.surface, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginBottom: 28 }}>
          {others.map((m, i) => (
            <View key={m.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 64 }} />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                {m.avatar_url ? (
                  <Image source={{ uri: m.avatar_url }} style={{ width: 36, height: 36, borderRadius: theme.radii.xxl, backgroundColor: colors.surfaceSunken }} />
                ) : (
                  <View style={{ width: 36, height: 36, borderRadius: theme.radii.xxl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.onAccent, fontSize: theme.type.caption, fontFamily: theme.fonts.medium }}>{initialsFor(m.name)}</Text>
                  </View>
                )}
                <Text style={{ flex: 1, fontSize: theme.type.body, color: colors.text, fontFamily: theme.fonts.medium }} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.id === house.owner_id && (
                  <Text style={{ fontSize: theme.type.caption, color: colors.accent, fontFamily: theme.fonts.medium }}>Owner</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <Tappable
        onPress={go}
        haptic
        accessibilityRole="button"
        accessibilityLabel="Continue to your household"
        style={{ backgroundColor: colors.accent, borderRadius: theme.radii.md, height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
      >
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.onAccent} />
        <Text style={{ color: colors.onAccent, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>Let's go</Text>
      </Tappable>
    </ScrollView>
  );
}
