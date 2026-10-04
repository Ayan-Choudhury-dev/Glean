import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { LayoutGrid, ShoppingCart, Settings } from 'lucide-react-native';

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.medium,
          fontSize: theme.type.micro,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Shopping list',
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
