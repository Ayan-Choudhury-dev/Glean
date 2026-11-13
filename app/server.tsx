import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, Share, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/lib/appearance';
import { theme } from '@/constants/theme';
import { Text } from '@/components/ui/text';
import { Tappable } from '@/components/ui/tappable';
import { showDialog, showToast } from '@/lib/overlay';
import { getServerConfig, saveServerConfig, clearServerConfig, normalizeAddress, DEFAULT_SERVER_KEY } from '@/lib/serverConfig';
import { initSupabase, clearSupabase, testConnection } from '@/lib/supabase';
import {
  probePocketBase,
  initPocketBase,
  clearPocketBase,
  loginPocketBase,
  pocketBaseToken,
  restorePocketBaseAuth,
} from '@/lib/pocketbase';
import { pushHouse, firstServerHouseId, createPairingCode, redeemPairingCode } from '@/lib/sync';
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
  /** Optional joining code, typed on the phone that is joining. */
  const [pairCode, setPairCode] = useState('');
  /** Code minted on this phone for someone else to redeem. */
  const [minted, setMinted] = useState<string | null>(null);
  /** Filled once the probe says this address is a PocketBase server. */
  const [pbLogin, setPbLogin] = useState<{ email: string; password: string } | null>(null);
  const profile = useGleanStore(s => s.profile);

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
      if (cfg.backend === 'pocketbase') {
        initPocketBase(cfg.url);
        restorePocketBaseAuth(cfg.token ?? '');
      } else {
        initSupabase(cfg);
      }
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
    const base = normalizeAddress(address);
    if (!base) {
      setError('Enter your server’s address, for example http://192.168.1.20:8000');
      return;
    }
    setPhase('checking');

    // Which server is this? PocketBase answers /api/health; the bundled
    // Postgres + PostgREST does not.
    const isPocketBase = await probePocketBase(base);
    if (isPocketBase) {
      if (!pbLogin) {
        setPbLogin({ email: '', password: '' });
        setPhase('idle');
        return;
      }
      initPocketBase(base);
      const loginError = await loginPocketBase(pbLogin.email.trim(), pbLogin.password);
      if (loginError) {
        setPhase('idle');
        setError(`Sign-in failed.\n\n${loginError}`);
        return;
      }
      await saveServerConfig({
        url: base,
        anonKey: '',
        backend: 'pocketbase',
        token: pocketBaseToken(),
      });
      const houseId = pairCode.trim()
        ? await redeemPairingCode(pairCode)
        : await firstServerHouseId();
      if (pairCode.trim() && !houseId) {
        setPhase('idle');
        setError('That code has expired or was already used. Ask for a new one — codes last ten minutes.');
        return;
      }
      if (houseId && useGleanStore.getState().house?.id !== houseId) {
        await useGleanStore.getState().adoptServerHouse(houseId);
      }
      setSavedAddress(base);
      setPairCode('');
      setPhase('connected');
      showToast('Connected to your server');
      return;
    }

    const config = cfg();
    const failure = await testConnection(config);
    if (failure) {
      setPhase('idle');
      const authProblem = /401|403|invalid api key|jwt/i.test(failure);
      if (authProblem) {
        setAdvancedOpen(true);
        setError(
          `This server rejected the key.\n\nPaste its token under Advanced — the same value as GLEAN_TOKEN on the server.`,
        );
        return;
      }
      setError(
        `Couldn’t reach ${config.url}.\n\n` +
        'Check the address, and that the server is running. On another network you may need a tunnel or a VPN.',
      );
      return;
    }

    initSupabase(config);

    // Joining by code: the code names the pantry, so there is nothing to choose.
    if (pairCode.trim()) {
      const joinedId = await redeemPairingCode(pairCode);
      if (!joinedId) {
        setPhase('idle');
        setError('That code has expired or was already used. Ask for a new one — codes last ten minutes.');
        return;
      }
      await saveServerConfig(config);
      const ok = await useGleanStore.getState().adoptServerHouse(joinedId);
      if (!ok) {
        setPhase('idle');
        setError('The server answered, but that pantry could not be loaded. Try again.');
        return;
      }
      setSavedAddress(config.url);
      setPairCode('');
      setPhase('connected');
      showToast('Joined the household pantry');
      return;
    }

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

  const handleCreateCode = async () => {
    const house = useGleanStore.getState().house;
    if (!house) return;
    const code = await createPairingCode(house.id);
    if (!code) {
      showToast('Could not create a code — is the server reachable?');
      return;
    }
    setMinted(code);
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
          {connected ? 'Shared · anyone with the address' : 'This phone only'}
        </Text>
      </View>

      <Text style={{ color: colors.text, fontSize: theme.type.heading, fontFamily: theme.fonts.display, marginBottom: 8 }}>
        {connected ? 'Your pantry is shared' : 'Add someone to your pantry'}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: theme.type.label, marginBottom: 6, lineHeight: 21 }}>
        {connected
          ? 'Their phone reads the same stock and the same shopping list. Add something here, it shows up there.'
          : 'Glean keeps the pantry on this phone. To let someone else use it, both phones have to talk to one server you run — that is the only way two phones can share without an account.'}
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

          <SectionLabel>Members</SectionLabel>
          <Card>
            <Row icon="person-outline" label="You" value={profile?.name ?? ''} />
            <Divider />
            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, lineHeight: 19 }}>
                There is no member list to show — the server is the shared thing. Anyone who enters this address joins.
              </Text>
            </View>
          </Card>

          {minted ? (
            <View style={{ backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: theme.radii.lg, padding: 18, alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.caption }}>Joining code · valid 10 minutes</Text>
              <Text style={{ color: colors.text, fontSize: 34, letterSpacing: 8, fontFamily: theme.fonts.monoMedium }}>{minted}</Text>
              <Tappable
                onPress={() => {
                  if (!savedAddress) return;
                  void Share.share({
                    message: `Join our pantry in Glean: open Settings → Add member, enter ${savedAddress}, then the code ${minted}.`,
                  }).catch(() => showToast('Could not open the share sheet'));
                }}
                accessibilityRole="button"
                accessibilityLabel="Send the joining code"
                style={{ marginTop: 4, height: 40, paddingHorizontal: 16, borderRadius: theme.radii.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.onAccent, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>Send it</Text>
              </Tappable>
            </View>
          ) : (
            <>
              <PrimaryButton label="Create a code" onPress={() => { void handleCreateCode(); }} />
              <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, lineHeight: 19, marginTop: 10, textAlign: 'center' }}>
                They open Glean → Settings → Add member → enter this address and the code.
              </Text>
            </>
          )}

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

          <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginTop: 18, marginBottom: 8, marginLeft: 4 }}>
            Joining code (optional)
          </Text>
          <TextInput
            value={pairCode}
            onChangeText={text => { setPairCode(text.toUpperCase().slice(0, 6)); setError(null); }}
            placeholder="ABC234"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            editable={phase !== 'checking'}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: theme.radii.md,
              paddingHorizontal: 16,
              height: 52,
              fontSize: theme.type.title,
              letterSpacing: 4,
              color: colors.text,
              fontFamily: theme.fonts.mono,
            }}
          />
          <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, marginTop: 8, lineHeight: 18 }}>
            Someone already in the household can make one: Settings → Add member → Create a code.
          </Text>

          {pbLogin && (
            <View style={{ marginTop: 18, gap: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, fontFamily: theme.fonts.medium, marginLeft: 4 }}>
                This server is PocketBase — sign in
              </Text>
              <TextInput
                value={pbLogin.email}
                onChangeText={email => setPbLogin(prev => (prev ? { ...prev, email } : prev))}
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radii.md,
                  paddingHorizontal: 16,
                  height: 52,
                  fontSize: theme.type.body,
                  color: colors.text,
                }}
              />
              <TextInput
                value={pbLogin.password}
                onChangeText={password => setPbLogin(prev => (prev ? { ...prev, password } : prev))}
                placeholder="Password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radii.md,
                  paddingHorizontal: 16,
                  height: 52,
                  fontSize: theme.type.body,
                  color: colors.text,
                }}
              />
              <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, lineHeight: 18 }}>
                The account you created on your own server. It never leaves it.
              </Text>
            </View>
          )}

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

                {remote.houseId && localCount > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: theme.type.caption, marginTop: 10, lineHeight: 19 }}>
                    Joining replaces the {localCount} {localCount === 1 ? 'item' : 'items'} on this phone with the household pantry.
                  </Text>
                )}

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
              label={
                phase === 'checking'
                  ? 'Looking for your server…'
                  : pbLogin && !(pbLogin.email.trim() && pbLogin.password)
                    ? 'Enter your server account'
                    : 'Connect'
              }
              onPress={handleConnect}
              busy={phase === 'checking'}
              disabled={
                phase === 'checking' ||
                phase === 'choose' ||
                (!!pbLogin && !(pbLogin.email.trim() && pbLogin.password))
              }
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
