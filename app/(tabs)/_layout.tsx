import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { router } from 'expo-router';

import { useGleanStore } from '@/store/useGleanStore';
import { theme } from '@/constants/theme';

export default function TabLayout() {
  const { profile } = useGleanStore();

  useEffect(() => {
    if (!profile) router.replace('/onboarding');
  }, [profile]);

  if (!profile) return <View style={{ flex: 1, backgroundColor: theme.colors.surface }} />;

  return (
    <NativeTabs
      backgroundColor={theme.colors.surface}
      labelStyle={{
        default: { color: theme.colors.textMuted, fontFamily: theme.fonts.medium, fontSize: 11 },
        selected: { color: theme.colors.accent, fontFamily: theme.fonts.semibold, fontSize: 11 },
      }}
      badgeBackgroundColor={theme.colors.accent}
      rippleColor={theme.colors.pressed}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon src={require('../../assets/images/nav/inventory.png')} renderingMode="original" />
        <NativeTabs.Trigger.Label>Inventory</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shopping">
        <NativeTabs.Trigger.Icon src={require('../../assets/images/nav/shopping.png')} renderingMode="original" />
        <NativeTabs.Trigger.Label>Shopping list</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon src={require('../../assets/images/nav/settings.png')} renderingMode="original" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
