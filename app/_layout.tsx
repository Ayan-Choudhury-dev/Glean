import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
} from '@expo-google-fonts/geist-mono';
import {
  Fraunces_300Light,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useGleanStore } from '@/store/useGleanStore';
import { Tappable } from '@/components/ui/tappable';
import { Text } from '@/components/ui/text';
import { OverlayHost } from '@/components/OverlayHost';
import { theme } from '@/constants/theme';
import { useAppearance, useColors } from '@/lib/appearance';
import '@/global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  // Start on the tabs so a restored session never flashes the login screen;
  // (tabs)/_layout redirects to onboarding when there is no session.
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    Fraunces_300Light,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    ...FontAwesome.font,
  });
  const { loadSession, clearSession, handleAuthRedirect, refreshMembership } = useGleanStore();
  const sessionLoaded = useGleanStore(s => s.sessionLoaded);
  const colors = useColors();
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.text,
      primary: colors.accent,
      notification: colors.accent,
    },
  };

  useEffect(() => { if (error) throw error; }, [error]);
  // Keep the splash up until fonts AND the restored session are ready — otherwise
  // the login screen flashes before the session resolves.
  useEffect(() => { if (loaded && sessionLoaded) SplashScreen.hideAsync(); }, [loaded, sessionLoaded]);

  // Restore session on cold start
  useEffect(() => {
    loadSession();
  }, []);

  // Safety: never let a slow/hung session request trap the app on the splash.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useGleanStore.getState().sessionLoaded) useGleanStore.setState({ sessionLoaded: true });
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // Restore the saved appearance preference.
  const hydrateAppearance = useAppearance(s => s.hydrate);
  useEffect(() => {
    hydrateAppearance();
  }, [hydrateAppearance]);

  // Handle deep link redirects (magic link auth)
  useEffect(() => {
    const onUrl = async ({ url }: { url: string }) => {
      if (url.includes('access_token')) {
        await handleAuthRedirect(url);
        // Password-recovery links land here too; send the user to set a new one.
        if (url.includes('type=recovery')) {
          router.replace('/reset-password');
          return;
        }
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

  // Keep the splash up until the fonts are actually registered. Rendering the
  // tree first lays text out with fallback metrics; when the custom fonts swap in
  // the glyph widths change but RN does not always re-measure, which clipped the
  // first screen ("Glea", "Sign up" -> "Sign").
  if ((!loaded && !error) || !sessionLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
            <Stack.Screen name="house-setup" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
            <Stack.Screen name="item-form"   options={{ headerShown: false, presentation: 'modal', contentStyle: { backgroundColor: colors.surface } }} />
            <Stack.Screen name="members"     options={{ title: 'Members', headerBackTitle: 'Settings', contentStyle: { backgroundColor: colors.background } }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="joined"     options={{ headerShown: false }} />
            <Stack.Screen name="scan"       options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          </Stack>
          <SyncErrorBanner />
          <OverlayHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function SyncErrorBanner() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
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
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.dangerBorder,
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
      <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
      <Text style={{ flex: 1, fontSize: theme.type.label, color: colors.text }}>{syncError}</Text>
      <Tappable onPress={clearSyncError} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss error">
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Tappable>
    </View>
  );
}
