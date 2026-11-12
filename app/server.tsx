import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/lib/appearance';
import { theme } from '@/constants/theme';
import { Text } from '@/components/ui/text';
import { Tappable } from '@/components/ui/tappable';
import { showDialog, showToast } from '@/lib/overlay';
import { getServerConfig, saveServerConfig, clearServerConfig, normalizeAddress, DEFAULT_SERVER_KEY } from '@/lib/serverConfig';
import { initSupabase, clearSupabase, testConnection } from '@/lib/supabase';
import { pushHouse, firstServerHouseId } from '@/lib/sync';
import { useGleanStore } from '@/store/useGleanStore';

/**
 * Sharing screen.
 *
 * The only thing a person can actually know is their server's address, so that
 * is the only field. Everything after it is a decision the screen makes for
 * them: probe, say what it found, then ask which pantry wins — instead of
 * leaving "restore" as a button that silently replaces local data.
 */

type Phase = 'idle' | 'checking' | 'choose' | 'connected';

const DEFAULT_KEY = DEFAULT_SERVER_KEY;

export default function ServerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [address, setAddress] = useState('');
  const [key, setKey] = useState(DEFAULT_KEY);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  /** What the probe found on the server, and how much this phone holds. */
  const [remote, setRemote] = useState<{ houseId: string | null } | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [savedAddress, setSavedAddress] = useState<string | null>(null);

  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const cfg = await getServerConfig();
      const count = useGleanStore.getState().inventory.length;
      setLocalCount(count);
      if (!cfg) return;
      setAddress(cfg.url);
      setKey(cfg.anonKey);
      setSavedAddress(cfg.url);
      initSupabase(cfg);
      setPhase('connected');
    })();
  }, []);

  // Anything that appears after an action slides in, so the screen never jumps.
  useEffect(() => {
    if (phase === 'idle') return;
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [phase, reveal]);

  const cfg = (url = address) => ({ url: normalizeAddress(url), anonKey: key.trim() || DEFAULT_KEY });

  /** Probe the address, then decide whether to ask the user anything at all. */
  const handleConnect = async () => {
    setError(null);
    const config = cfg();
    if (!config.url) {
      setError('Enter your server’s address, for example http://192.168.1.20:8000');
      return;
    }
    setPhase('checking');

    const failure = await testConnection(config);
    if (failure) {
      setPhase('idle');
      setError(
        `Couldn’t reach ${config.url}.\n\n` +
        'Check the address, and that the server is running. On another network you may need a tunnel or a VPN.',
      );
      return;
    }

    initSupabase(config);
    const houseId = await firstServerHouseId();
    setRemote({ houseId });
    setLocalCount(useGleanStore.getState().inventory.length);
    setPhase('choose');
  };

  /** Finish connecting in the chosen direction. */
  const finish = async (direction: 'upload' | 'adopt') => {
    const config = cfg();
    await saveServerConfig(config);
    initSupabase(config);

    if (direction === 'adopt' && remote?.houseId) {
      const ok = await useGleanStore.getState().adoptServerHouse(remote.houseId);
      if (!ok) {
        showDialog({ title: 'Could not read that pantry', message: 'The server answered, but the pantry could not be loaded. Try again.', cancelLabel: null });
        return;
      }
    } else {
      const house = useGleanStore.getState().house;
      if (house) await pushHouse(house.id);
    }

    setSavedAddress(config.url);
    setPhase('connected');
    showToast(direction === 'adopt' ? 'Using the pantry on your server' : 'Pantry uploaded');
  };

  const handleUploadOverRemote = () => {
    showDialog({
      title: 'Replace the pantry on your server?',
      message: 'The pantry on the server will be overwritten with what is on this phone.',
      confirmLabel: 'Replace',
      cancelLabel: 'Cancel',
      destructive: true,
      onConfirm: () => { void finish('upload'); },
    });
  };

  const handleDisconnect = () => {
    showDialog({
      title: 'Stop sharing?',
      message: 'This phone goes back to its own pantry. Nothing is deleted, on this phone or on the server.',
      confirmLabel: 'Stop sharing',
      cancelLabel: 'Cancel',
      onConfirm: () => {
        clearSupabase();
        void clearServerConfig().then(() => {
          setPhase('idle');
          setSavedAddress(null);
          setRemote(null);
          showToast('This phone is on its own again');
        });
      },
    });
  };

  const connected = phase === 'connected';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Status ─────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? colors.accent : colors.borderStrong }} />
        <Text style={{ color: colors.textMuted, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>
          {connected ? 'Shared with your household' : 'This phone only'}
        </Text>
      </View>

      <Text style={{ color: colors.text, fontSize: theme.type.heading, fontFamily: theme.fonts.display, marginBottom: 8 }}>
        One pantry, everyone at home
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: theme.type.label, marginBottom: 6, lineHeight: 21 }}>
        {connected
          ? 'Everyone who enters this address sees the same stock and the same shopping list. Add something here, it shows up on their phone.'
          : 'Right now this pantry lives on this phone. Connect a Glean server you run and the people you live with see the same stock and the same shopping list.'}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: theme.type.label, marginBottom: 22, lineHeight: 21 }}>
        You keep the server. No account here, nothing sent anywhere else.
      </Text>

      {connected ? (
        <>
          <Card>
            <Row icon="server-outline" label="Server" value={savedAddress ?? ''} />
            <Divider />
            <Row icon="basket-outline" label="Items on this phone" value={String(localCount)} />
          </Card>

          <SectionLabel>Add your household</SectionLabel>
          <Card>
            <View style={{ padding: 16, gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>
                On their phone
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.label, lineHeight: 21 }}>
                Settings → Share with your household → enter <Text style={{ color: colors.text, fontFamily: theme.fonts.medium }}>{savedAddress}</Text>
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.label, lineHeight: 21 }}>
                Then choose “Use the pantry from the server”. They will see this pantry, not their own.
              </Text>
            </View>
          </Card>

          <SecondaryButton label="Stop sharing" onPress={handleDisconnect} tone="danger" />
        </>
      ) : (
        <>
          <SectionLabel>Your server’s address</SectionLabel>
          <TextInput
            value={address}
            onChangeText={text => {
              setAddress(text);
              setError(null);
              // Editing the address invalidates whatever the last probe found.
              if (phase === 'choose') { setPhase('idle'); setRemote(null); }
            }}
            placeholder="192.168.1.20:8000"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={phase !== 'checking'}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: error ? colors.dangerBorder : colors.border,
              borderRadius: theme.radii.md,
              paddingHorizontal: 16,
              height: 52,
              fontSize: theme.type.body,
              color: colors.text,
              fontFamily: theme.fonts.mono,
            }}
          />
          <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, marginTop: 8, lineHeight: 18 }}>
            Whatever address you open the Glean server on in a browser. http:// is added for you.
          </Text>

          {error && (
            <Animated.View style={{ opacity: reveal, marginTop: 12, flexDirection: 'row', gap: 10, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: theme.radii.md, padding: 14 }}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: colors.dangerText, fontSize: theme.type.caption, lineHeight: 19 }}>{error}</Text>
            </Animated.View>
          )}

          {/* What the probe found — the decision that used to be a hidden button. */}
          {phase === 'choose' && remote && (
            <Animated.View
              style={{
                marginTop: 16,
                opacity: reveal,
                transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              }}
            >
              <View style={{ backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: theme.radii.lg, padding: 16 }}>
                <Text style={{ color: colors.text, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>
                  {remote.houseId ? 'This server already has a pantry' : 'This server is empty'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, marginTop: 4, lineHeight: 19 }}>
                  {remote.houseId
                    ? localCount > 0
                      ? `This phone has ${localCount} ${localCount === 1 ? 'item' : 'items'}. Which pantry should the household use?`
                      : 'Load it onto this phone to see the household’s pantry.'
                    : `Upload the ${localCount} ${localCount === 1 ? 'item' : 'items'} on this phone, and everyone else joins from there.`}
                </Text>

                <View style={{ gap: 10, marginTop: 14 }}>
                  {remote.houseId ? (
                    <>
                      <PrimaryButton label="Use the pantry from the server" onPress={() => { void finish('adopt'); }} />
                      {localCount > 0 && (
                        <SecondaryButton label="Replace it with this phone’s pantry" onPress={handleUploadOverRemote} />
                      )}
                    </>
                  ) : (
                    <PrimaryButton label="Upload this pantry" onPress={() => { void finish('upload'); }} />
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          <View style={{ marginTop: 20 }}>
            <PrimaryButton
              label={phase === 'checking' ? 'Looking for your server…' : 'Connect'}
              onPress={handleConnect}
              busy={phase === 'checking'}
              disabled={phase === 'checking' || phase === 'choose'}
            />
          </View>

          {/* Advanced: only the people running a proxy that demands a key. */}
          <Tappable
            onPress={() => setAdvancedOpen(open => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            accessibilityLabel="Advanced options"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingVertical: 8 }}
          >
            <Ionicons name={advancedOpen ? 'chevron-down' : 'chevron-forward'} size={15} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>Advanced</Text>
          </Tappable>

          {advancedOpen && (
            <View style={{ marginTop: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, marginBottom: 6, lineHeight: 18 }}>
                Server key. The bundled server accepts any value, so you only need this if you put something in front of it that asks for one.
              </Text>
              <TextInput
                value={key}
                onChangeText={setKey}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={DEFAULT_KEY}
                placeholderTextColor={colors.textFaint}
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radii.md,
                  paddingHorizontal: 16,
                  height: 48,
                  fontSize: theme.type.label,
                  color: colors.text,
                  fontFamily: theme.fonts.mono,
                }}
              />
            </View>
          )}

          <View style={{ marginTop: 28, gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>
              No server yet?
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, lineHeight: 19 }}>
              Glean’s repository ships a small Docker setup: one command on any machine at home, or a VPS. Then come back and enter its address.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginBottom: 8, marginLeft: 4 }}>
      {children}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: theme.radii.lg, overflow: 'hidden', marginBottom: 18 }}>
      {children}
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 16 }} />;
}

function Row({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={{ flex: 1, color: colors.text, fontSize: theme.type.label }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.mono }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      haptic
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      accessibilityLabel={label}
      style={{
        minHeight: 52,
        borderRadius: theme.radii.md,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled && !busy ? 0.45 : 1,
      }}
    >
      {busy && <ActivityIndicator color={colors.onAccent} />}
      <Text style={{ color: colors.onAccent, fontSize: theme.type.md, fontFamily: theme.fonts.medium }}>{label}</Text>
    </Tappable>
  );
}

function SecondaryButton({ label, onPress, tone }: { label: string; onPress: () => void; tone?: 'danger' }) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 48,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
      }}
    >
      <Text style={{ color: tone === 'danger' ? colors.danger : colors.text, fontSize: theme.type.md, fontFamily: theme.fonts.medium }}>{label}</Text>
    </Tappable>
  );
}
