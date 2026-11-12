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
import { AppState, Platform, View, useColorScheme } from 'react-native';
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
import { getServerConfig } from '@/lib/serverConfig';
import { initSupabase } from '@/lib/supabase';
import { checkForUpdate, downloadAndInstall } from '@/lib/updates';
import { showDialog } from '@/lib/overlay';
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

  // Restore the self-hosted server connection (if configured).
  useEffect(() => {
    getServerConfig().then(cfg => { if (cfg) initSupabase(cfg); });
  }, []);

  // Self-update check: the app ships as an APK from GitHub releases. On Android
  // we download and hand it to the system installer, so updating does not mean
  // hunting for the release page.
  useEffect(() => {
    checkForUpdate().then(update => {
      if (!update) return;
      if (Platform.OS !== 'android' || !update.apkUrl) {
        showDialog({
          title: 'Update available',
          message: `Glean ${update.version} is ready to download.`,
          confirmLabel: 'Download',
          cancelLabel: 'Later',
          onConfirm: () => { void Linking.openURL(update.url); },
        });
        return;
      }
      showDialog({
        title: 'Update available',
        message: `Glean ${update.version} is ready. Your pantry is kept.`,
        confirmLabel: 'Install',
        cancelLabel: 'Later',
        onConfirm: () => {
          void downloadAndInstall(update).catch(err => {
            showDialog({
              title: 'Could not install the update',
              message: `${err instanceof Error ? err.message : String(err)}\n\nYou can download it from the release page instead.`,
              confirmLabel: 'Open page',
              cancelLabel: 'Close',
              onConfirm: () => { void Linking.openURL(update.url); },
            });
          });
        },
      });
    });
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
            <Stack.Screen name="server"      options={{ title: 'Server', contentStyle: { backgroundColor: colors.background } }} />
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
