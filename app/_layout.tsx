import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
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
  const colorScheme = useColorScheme();
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
    <GluestackUIProvider mode={colorScheme ?? 'light'}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
          <Stack.Screen name="house-setup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
          <Stack.Screen name="item-form"   options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
