import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { useGleanStore } from '@/store/useGleanStore';
import { Tappable } from '@/components/ui/tappable';
import { theme } from '@/constants/theme';
import '@/global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'onboarding',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const { loadSession, clearSession, handleAuthRedirect } = useGleanStore();

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  // Restore session on cold start
  useEffect(() => {
    loadSession();
  }, []);

  // Listen for auth changes (token refresh, sign-out from another device, etc.)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearSession();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Handle deep link redirects (magic link auth)
  useEffect(() => {
    const onUrl = async ({ url }: { url: string }) => {
      if (url.includes('access_token')) {
        await handleAuthRedirect(url);
        const { profile } = useGleanStore.getState();
        if (profile) {
          router.replace(profile.house_id ? '/(tabs)' : '/house-setup');
        }
      }
    };

    const sub = Linking.addEventListener('url', onUrl);

    // Handle cold-start deep link
    Linking.getInitialURL().then(url => {
      if (url) onUrl({ url });
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={DefaultTheme}>
          <StatusBar style="dark" />
          <Stack>
            <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
            <Stack.Screen name="house-setup" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
            <Stack.Screen name="item-form"   options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
          <SyncErrorBanner />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function SyncErrorBanner() {
  const insets = useSafeAreaInsets();
  const { syncError, clearSyncError } = useGleanStore();
  if (!syncError) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 50,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.dangerBorder,
        borderRadius: theme.radii.md,
        paddingLeft: 14,
        paddingRight: 8,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        ...theme.elevation.floating,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.danger} />
      <Text style={{ flex: 1, fontSize: 14, color: theme.colors.text }}>{syncError}</Text>
      <Tappable onPress={clearSyncError} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss error">
        <Ionicons name="close" size={18} color={theme.colors.textMuted} />
      </Tappable>
    </View>
  );
}
