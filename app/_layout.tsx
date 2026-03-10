import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { supabase } from '@/lib/supabase';
import { useGleanStore } from '@/store/useGleanStore';
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

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  if (!loaded) return null;
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { loadSession, signOut } = useGleanStore();

  // Restore session on cold start
  useEffect(() => {
    loadSession();
  }, []);

  // Listen for auth changes (token refresh, sign-out from another device, etc.)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') signOut();
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <GluestackUIProvider mode={colorScheme ?? 'light'}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
          <Stack.Screen name="house-setup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
          <Stack.Screen name="item-form"   options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="modal"       options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
