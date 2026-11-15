import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/lib/appearance';

/**
 * Entry point for a joining QR.
 *
 * The code on the server encodes `glean://join?server=…&code=…`; any camera app
 * hands that to the OS, which opens Glean here. All this does is carry the two
 * values to the connect screen, which already knows how to redeem them.
 */
export default function JoinScreen() {
  const colors = useColors();
  const { server, code } = useLocalSearchParams<{ server?: string; code?: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/server',
      params: {
        ...(server ? { server: String(server) } : {}),
        ...(code ? { code: String(code) } : {}),
      },
    });
  }, [server, code]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
