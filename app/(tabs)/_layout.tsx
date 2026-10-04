import React, { useEffect } from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs, router } from 'expo-router';
import { LayoutGrid, ShoppingCart, Settings } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

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

  const renderIcon = (Icon: LucideIcon) =>
    ({ focused, color }: { focused: boolean; color: ColorValue }) => (
      <View
        style={{
          width: 56,
          height: 32,
          borderRadius: theme.radii.pill,
          backgroundColor: focused ? colors.accentSoft : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon color={color as string} size={22} strokeWidth={focused ? 2.4 : 2} />
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarItemStyle: { paddingTop: 6 },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.medium,
          fontSize: theme.type.micro,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inventory', tabBarIcon: renderIcon(LayoutGrid) }} />
      <Tabs.Screen name="shopping" options={{ title: 'Shopping list', tabBarIcon: renderIcon(ShoppingCart) }} />
      <Tabs.Screen name="profile" options={{ title: 'Settings', tabBarIcon: renderIcon(Settings) }} />
    </Tabs>
  );
}
