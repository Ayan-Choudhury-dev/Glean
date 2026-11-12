import React, { useEffect, useState } from 'react';
import { View, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/lib/appearance';
import { theme } from '@/constants/theme';
import { Text } from '@/components/ui/text';
import { Tappable } from '@/components/ui/tappable';
import { showToast } from '@/lib/overlay';
import { getServerConfig, saveServerConfig, clearServerConfig } from '@/lib/serverConfig';
import { initSupabase, clearSupabase, testConnection } from '@/lib/supabase';
import { pushHouse, firstServerHouseId } from '@/lib/sync';
import { useGleanStore } from '@/store/useGleanStore';

export default function ServerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cfg = await getServerConfig();
      if (cfg) {
        setUrl(cfg.url);
        setAnonKey(cfg.anonKey);
        initSupabase(cfg);
        setConnected(true);
      }
    })();
  }, []);

  const inputStyle = {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: theme.type.body,
    color: colors.text,
    fontFamily: theme.fonts.regular,
  };

  const handleTest = async () => {
    setError(null);
    if (!url.trim() || !anonKey.trim()) {
      setError('Enter both the URL and the anon key.');
      return;
    }
    setBusy(true);
    const err = await testConnection({ url: url.trim(), anonKey: anonKey.trim() });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    showToast('Connection OK');
  };

  const handleSave = async () => {
    setError(null);
    const cfg = { url: url.trim(), anonKey: anonKey.trim() };
    if (!cfg.url || !cfg.anonKey) {
      setError('Enter both the URL and the anon key.');
      return;
    }
    setBusy(true);
    const err = await testConnection(cfg);
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    await saveServerConfig(cfg);
    initSupabase(cfg);
    const house = useGleanStore.getState().house;
    if (house) void pushHouse(house.id);
    setBusy(false);
    setConnected(true);
    showToast('Connected — backing up to your server');
  };

  const handleDisconnect = async () => {
    clearSupabase();
    await clearServerConfig();
    setConnected(false);
    showToast('Disconnected — running local-only');
  };

  const handleRestore = async () => {
    setError(null);
    setBusy(true);
    try {
      const houseId = await firstServerHouseId();
      if (!houseId) {
        setBusy(false);
        setError('No pantry found on the server yet.');
        return;
      }
      const ok = await useGleanStore.getState().adoptServerHouse(houseId);
      setBusy(false);
      if (ok) showToast('Restored from server');
      else setError('Could not restore from the server.');
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? colors.accent : colors.borderStrong }} />
        <Text style={{ color: colors.textMuted, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>
          {connected ? 'Shared with your household' : 'This phone only'}
        </Text>
      </View>

      <Text style={{ color: colors.text, fontSize: theme.type.heading, fontFamily: theme.fonts.display, marginBottom: 8 }}>
        One pantry, everyone at home
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: theme.type.label, marginBottom: 8, lineHeight: 21 }}>
        Right now this pantry lives on this phone. Connect a server you run and the people you live with see the same stock and the same shopping list — add something on one phone, it shows up on the others.
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: theme.type.label, marginBottom: 20, lineHeight: 21 }}>
        You keep the server. No account here, nothing sent anywhere else.
      </Text>

      <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginBottom: 6, marginLeft: 4 }}>
        Supabase URL
      </Text>
      <TextInput
        style={inputStyle}
        value={url}
        onChangeText={setUrl}
        placeholder="https://your-project.supabase.co"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginTop: 16, marginBottom: 6, marginLeft: 4 }}>
        Anon key
      </Text>
      <TextInput
        style={[inputStyle, { minHeight: 96 }]}
        value={anonKey}
        onChangeText={setAnonKey}
        placeholder="eyJhbGciOi..."
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />

      {error && (
        <Text style={{ color: colors.danger, fontSize: theme.type.caption, marginTop: 12 }}>
          {error}
        </Text>
      )}

      <View style={{ gap: 12, marginTop: 24 }}>
        <Tappable
          onPress={handleSave}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Save and connect"
          style={{ backgroundColor: colors.accent, borderRadius: theme.radii.md, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={{ color: colors.onAccent, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>
              Save & connect
            </Text>
          )}
        </Tappable>

        <Tappable
          onPress={handleTest}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Test connection"
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.md, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.text, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>
            Test connection
          </Text>
        </Tappable>

        {connected && (
          <Tappable
            onPress={handleRestore}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Restore from server"
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.md, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.text, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>
              Restore from server
            </Text>
          </Tappable>
        )}

        {connected && (
          <Tappable
            onPress={handleDisconnect}
            accessibilityRole="button"
            accessibilityLabel="Disconnect"
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.danger, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>
              Disconnect
            </Text>
          </Tappable>
        )}
      </View>

      <Text style={{ color: colors.textFaint, fontSize: theme.type.caption, marginTop: 24, lineHeight: 18 }}>
        Run the bundled backend (see backend/README.md) or apply backend/init/01-schema.sql first.
      </Text>
    </ScrollView>
  );
}
