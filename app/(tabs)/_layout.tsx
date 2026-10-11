import React, { useEffect } from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useGleanStore } from '@/store/useGleanStore';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

const TAB_BAR_HEIGHT = 56;

export default function TabLayout() {
  const { profile } = useGleanStore();
  const colors = useColors();
  // Gesture bar / home indicator height — the bar must clear it, otherwise the
  // labels sit underneath the system swipe area.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!profile) router.replace('/onboarding');
    else if (!profile.house_id) router.replace('/house-setup');
  }, [profile]);

  if (!profile || !profile.house_id) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const renderIcon = (base: 'grid' | 'cart' | 'settings') =>
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
        <Ionicons name={focused ? base : `${base}-outline`} color={color as string} size={22} />
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
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
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
      <Tabs.Screen name="index" options={{ title: 'Pantry', tabBarIcon: renderIcon('grid') }} />
      <Tabs.Screen name="shopping" options={{ title: 'Shopping list', tabBarIcon: renderIcon('cart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Settings', tabBarIcon: renderIcon('settings') }} />
    </Tabs>
  );
}
