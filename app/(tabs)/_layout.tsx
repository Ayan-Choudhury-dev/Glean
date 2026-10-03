import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { router } from 'expo-router';

import { useGleanStore } from '@/store/useGleanStore';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

export default function TabLayout() {
  const { profile } = useGleanStore();
  const colors = useColors();

  useEffect(() => {
    if (!profile) router.replace('/onboarding');
  }, [profile]);

  if (!profile) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.accent}
      iconColor={{ default: colors.textMuted, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.textMuted, fontFamily: theme.fonts.medium, fontSize: theme.type.micro },
        selected: { color: colors.accent, fontFamily: theme.fonts.semibold, fontSize: theme.type.micro },
      }}
      badgeBackgroundColor={colors.accent}
      rippleColor={colors.pressed}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="grid_view" />
        <NativeTabs.Trigger.Label>Inventory</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shopping">
        <NativeTabs.Trigger.Icon sf="cart" md="shopping_cart" />
        <NativeTabs.Trigger.Label>Shopping list</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
