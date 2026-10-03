import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, layout } from '@/constants/theme';

/** Standard screen header: safe-area top inset + a 64px row with title and optional right slot. */
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height: layout.headerHeight + insets.top, paddingTop: insets.top }}>
      <View
        style={{
          height: layout.headerHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: layout.screenPadding,
        }}
      >
        <Text style={{ fontSize: theme.type.heading, fontWeight: '600', color: theme.colors.text }}>
          {title}
        </Text>
        {right}
      </View>
    </View>
  );
}
