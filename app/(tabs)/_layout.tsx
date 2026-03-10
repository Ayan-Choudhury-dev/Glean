import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Brand } from '@/constants/Colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  if (focused) {
    return (
      <View className="bg-white rounded-lg px-2 py-1">
        <Ionicons name={name} size={20} color="#0F172A" />
      </View>
    );
  }
  return <Ionicons name={name} size={22} color={Brand.tabInactive} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: Brand.tabInactive,
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Groceries',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'cube' : 'cube-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Shopping list',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'basket' : 'basket-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'More settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
