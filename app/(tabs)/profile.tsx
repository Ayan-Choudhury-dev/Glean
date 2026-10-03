import React, { useState } from 'react';
import { View, TextInput, ScrollView, Alert, Share, Linking, RefreshControl, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Tappable } from '../../components/ui/tappable';
import { CollapsibleHeaderBar, LargeTitle, useCollapsibleHeader, useHeaderContentInset } from '../../components/CollapsibleHeader';
import { uploadAvatar } from '@/lib/upload';
import { useGleanStore } from '../../store/useGleanStore';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Button, ButtonText } from '@/components/ui/button';
import { NativeSheet } from '../../components/NativeSheet';
import { theme, accents, type AccentKey } from '@/constants/theme';
import { useAppearance, useColors } from '@/lib/appearance';

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
  return initials || '?';
}

export default function ProfileScreen() {
  const { profile, house, inventory, importCSV, signOut, loadHouseData, setAvatar } = useGleanStore();
  const colors = useColors();
  const appearanceMode = useAppearance(s => s.mode);
  const setAppearanceMode = useAppearance(s => s.setMode);
  const accentKey = useAppearance(s => s.accent);
  const setAccentKey = useAppearance(s => s.setAccent);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [dataSheetOpen, setDataSheetOpen] = useState(false);
  const [dataTab, setDataTab] = useState<'import' | 'export'>('import');
  const { scrollY, onScroll } = useCollapsibleHeader();
  const headerInset = useHeaderContentInset();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (!house) return;
    setRefreshing(true);
    try { await loadHouseData(house.id); } finally { setRefreshing(false); }
  };

  const copyInvite = async () => {
    if (!house?.invite_code) return;
    await Clipboard.setStringAsync(house.invite_code);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const shareInvite = async () => {
    if (!house?.invite_code) return;
    await Share.share({
      message: `Join my household "${house.name ?? 'Glean'}" on Glean with invite code ${house.invite_code}`,
    });
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0] || !profile) return;
    const uri = result.assets[0].uri;
    const url = await uploadAvatar(uri, profile.id);
    setAvatar(url ?? uri);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/onboarding');
        },
      },
    ]);
  };
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const memberCount = house?.member_ids?.length ?? 1;
  const membersLabel = memberCount === 1 ? '1 member' : `${memberCount} members`;

  const handleImport = () => {
    if (!csvText.trim()) {
      Alert.alert('Empty input', 'Paste your CSV content first.');
      return;
    }
    setImporting(true);
    try {
      const { added, updated } = importCSV(csvText);
      setCsvText('');
      Alert.alert(
        'Import complete',
        `${added} item${added !== 1 ? 's' : ''} added, ${updated} item${updated !== 1 ? 's' : ''} updated.`
      );
    } catch {
      Alert.alert('Parse error', 'Could not read the CSV. Check the format and try again.');
    } finally {
      setImporting(false);
    }
  };

  const buildCsv = () => {
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const header = 'Name,Quantity,Category,Location';
    const rows = inventory.map(i =>
      [i.name, String(i.qty), i.category, i.location ?? ''].map(escape).join(',')
    );
    return [header, ...rows].join('\n');
  };

  const handleExport = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Export unavailable', 'Sharing is not supported on this platform.');
        return;
      }
      const file = new File(Paths.cache, 'glean-inventory.csv');
      if (file.exists) file.delete();
      file.create();
      file.write(buildCsv());
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Export inventory',
      });
    } catch (e) {
      console.error('[export] failed:', e);
      Alert.alert('Export failed', 'Could not export your inventory. Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CollapsibleHeaderBar title="Settings" scrollY={scrollY} />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerInset + 8, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        <LargeTitle title="Settings" scrollY={scrollY} />

      <View style={{ marginHorizontal: 24, marginTop: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Tappable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="Change profile photo">
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 56, height: 56, borderRadius: theme.radii.xxl, backgroundColor: colors.surfaceSunken }}
            />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: theme.radii.xxl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.surface, fontSize: theme.type.xl, fontWeight: '700' }}>{initialsFor(profile?.name ?? '')}</Text>
            </View>
          )}
        </Tappable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontSize: theme.type.caption, color: colors.textFaint, marginBottom: 4 }}>Signed in as</Text>
          <Text style={{ fontSize: theme.type.xl, fontWeight: '600', color: colors.primary }} numberOfLines={1}>{profile?.name ?? 'User'}</Text>
        </View>
      </View>

      {/* ── Household ──────────────────────────────────────────────────── */}
      <SectionHeader title="Household" />
      <Card>
        <SettingRow icon="home-outline" label="House name" value={house?.name ?? 'No house'} />
        <Divider />
        <SettingRow icon="people-outline" label="Members" value={membersLabel} />
        <Divider />
        <Tappable onPress={() => setInviteSheetOpen(true)}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-surfaceMuted dark:bg-[#2A2A2A] items-center justify-center mr-3">
              <Ionicons name="person-add-outline" size={16} color={colors.textMuted} />
            </View>
            <Text className="flex-1 text-sm font-medium text-muted dark:text-[#B3B3B3]">Invite a member</Text>
            <Text className="text-xs text-muted dark:text-[#B3B3B3]">Share invite code</Text>
          </HStack>
        </Tappable>
      </Card>

      {/* ── Data (import / export) ─────────────────────────────────────── */}
      <SectionHeader title="Data" />
      <Card>
        <Tappable onPress={() => setDataSheetOpen(true)}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-surfaceMuted dark:bg-[#2A2A2A] items-center justify-center mr-3">
              <Ionicons name="swap-horizontal-outline" size={16} color={colors.textMuted} />
            </View>
            <VStack className="flex-1">
              <Text className="text-sm font-medium text-muted dark:text-[#B3B3B3]">Import / export data</Text>
              <Text className="text-xs text-muted dark:text-[#B3B3B3]">{inventory.length} items · CSV format</Text>
            </VStack>
            <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
          </HStack>
        </Tappable>
      </Card>

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <SectionHeader title="Appearance" />
      <Card>
        <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
          {(['system', 'light', 'dark'] as const).map(m => {
            const active = appearanceMode === m;
            return (
              <Tappable
                key={m}
                onPress={() => setAppearanceMode(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Appearance: ${m}`}
                style={{ flex: 1, height: 40, borderRadius: theme.radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.accent : colors.chipBg }}
              >
                <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: active ? colors.onAccent : colors.text, textTransform: 'capitalize' }}>
                  {m}
                </Text>
              </Tappable>
            );
          })}
        </View>
      </Card>

      {/* ── Accent ─────────────────────────────────────────────────────── */}
      <SectionHeader title="Accent" />
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, padding: 16, justifyContent: 'space-between' }}>
          {(Object.keys(accents) as AccentKey[]).map(key => {
            const swatch = accents[key];
            const selected = accentKey === key;
            return (
              <Tappable
                key={key}
                onPress={() => setAccentKey(key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Accent ${swatch.label}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radii.xl,
                  backgroundColor: swatch.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: selected ? 3 : 0,
                  borderColor: colors.text,
                }}
              >
                {selected ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
              </Tappable>
            );
          })}
        </View>
      </Card>

      {/* ── About ──────────────────────────────────────────────────────── */}
      <SectionHeader title="About" />
      <Card>
        <SettingRow icon="information-circle-outline" label="App version" value="1.0.0" chevron={false} />
        <Divider />
        <SettingRow icon="help-circle-outline" label="Send feedback" onPress={() => Linking.openURL('mailto:hello@glean.app?subject=Glean%20feedback')} />
      </Card>

      {/* ── Account ────────────────────────────────────────────────────── */}
      <SectionHeader title="Account" />
      <Card>
        <Tappable onPress={handleSignOut}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-red-50 dark:bg-[#3A1E1E] items-center justify-center mr-3">
              <Ionicons name="log-out-outline" size={16} color={colors.danger} />
            </View>
            <Text className="flex-1 text-sm font-medium text-red-500 dark:text-[#FF6B6B]">Sign out</Text>
          </HStack>
        </Tappable>
      </Card>

      {/* Invite sheet */}
      <NativeSheet visible={inviteSheetOpen} onClose={() => setInviteSheetOpen(false)}>
        <VStack className="px-6 pt-2 pb-10" space="lg">
          <VStack space="xs">
            <Heading size="md">Invite a member</Heading>
            <Text className="text-sm text-muted dark:text-[#B3B3B3]">
              Share this invite code with housemates so they can join{' '}
              {house?.name ?? 'your household'}.
            </Text>
          </VStack>
          <View className="bg-surfaceMuted dark:bg-[#2A2A2A] border border-line dark:border-[#333333] rounded-xl py-6 items-center">
            <Text className="text-3xl font-bold text-ink dark:text-[#F2F2F2] tracking-[0.3em]">
              {house?.invite_code ?? '—'}
            </Text>
          </View>
          <VStack space="sm">
            <Button size="lg" className="bg-brand rounded-xl" onPress={copyInvite}>
              <Ionicons name="copy-outline" size={16} color={colors.onAccent} style={{ marginRight: 6 }} />
              <ButtonText className="text-white">Copy code</ButtonText>
            </Button>
            <Button size="lg" variant="outline" action="secondary" className="rounded-xl border-line dark:border-[#333333]" onPress={shareInvite}>
              <Ionicons name="share-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
              <ButtonText className="text-ink dark:text-[#F2F2F2]">Share invite</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </NativeSheet>

      {/* Import / export data sheet */}
      <NativeSheet visible={dataSheetOpen} onClose={() => setDataSheetOpen(false)}>
        <View className="px-6 pt-2 pb-10">
          {/* Header + tabs */}
          <HStack className="items-center mb-4">
            <Heading size="md" className="flex-1">Import / export data</Heading>
            <Tappable onPress={() => setDataSheetOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Tappable>
          </HStack>
          <HStack className="bg-surfaceMuted dark:bg-[#2A2A2A] rounded-xl p-1">
            {(['import', 'export'] as const).map(tab => (
              <Tappable
                key={tab}
                className={`flex-1 py-2 rounded-lg items-center ${dataTab === tab ? 'bg-white' : ''}`}
                style={dataTab === tab ? { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 } : undefined}
                onPress={() => setDataTab(tab)}
              >
                <Text className={`text-sm font-semibold capitalize ${dataTab === tab ? 'text-ink dark:text-[#F2F2F2]' : 'text-muted dark:text-[#B3B3B3]'}`}>
                  {tab === 'import' ? 'Import' : 'Export'}
                </Text>
              </Tappable>
            ))}
          </HStack>

          {dataTab === 'import' ? (
            <VStack className="pt-4" space="sm">
              <Text className="text-xs text-muted dark:text-[#B3B3B3]">
                Paste a CSV with headers:{' '}
                <Text className="font-mono font-semibold">Name, Quantity, Category, Location</Text>
              </Text>
              <Text className="text-xs text-muted dark:text-[#B3B3B3]">
                Upsert logic: existing items get their quantity incremented; new items are created.
              </Text>
              <TextInput
                className="bg-surfaceMuted dark:bg-[#2A2A2A] border border-line dark:border-[#333333] rounded-lg p-3 text-xs text-ink dark:text-[#F2F2F2] font-mono"
                style={{ minHeight: 140, textAlignVertical: 'top', fontFamily: theme.fonts.mono }}
                multiline
                placeholder={'Name,Quantity,Category,Location\nMilk,2,Dairy,Fridge\nRice,5,Grains,Pantry'}
                placeholderTextColor={colors.textFaint}
                value={csvText}
                onChangeText={setCsvText}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Button
                size="md"
                className="bg-brand rounded-xl mt-1"
                onPress={handleImport}
                disabled={importing}
              >
                <Ionicons name="cloud-upload-outline" size={16} color={colors.surface} style={{ marginRight: 6 }} />
                <ButtonText className="text-white">{importing ? 'Importing…' : 'Import CSV'}</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack className="pt-4" space="sm">
              <Text className="text-xs text-muted dark:text-[#B3B3B3]">
                Your inventory will be exported as a CSV file you can back up or share.
              </Text>
              <Tappable className="bg-surfaceMuted dark:bg-[#2A2A2A] border border-line dark:border-[#333333] rounded-lg px-4 py-2">
                <Text className="text-xs text-muted dark:text-[#B3B3B3] font-mono" numberOfLines={2}>
                  Name,Quantity,Category,Location · {inventory.length} rows
                </Text>
              </Tappable>
              <Button
                size="md"
                className="bg-brand rounded-xl mt-1"
                onPress={() => { setDataSheetOpen(false); handleExport(); }}
              >
                <Ionicons name="download-outline" size={16} color={colors.surface} style={{ marginRight: 6 }} />
                <ButtonText className="text-white">Export inventory</ButtonText>
              </Button>
            </VStack>
          )}
        </View>
      </NativeSheet>

    </Animated.ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={{ fontSize: theme.type.xl, fontWeight: '600', color: colors.primary, fontFamily: theme.fonts.display, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>{title}</Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ marginHorizontal: 24, backgroundColor: colors.surface, borderRadius: theme.radii.md, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
      {children}
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-surfaceMuted dark:bg-[#2A2A2A] ml-[52px]" />;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  chevron = true,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const colors = useColors();
  const row = (
    <HStack className="items-center px-4 py-3">
      <View className="w-8 h-8 rounded-lg bg-brandSoft dark:bg-[#3A1F27] items-center justify-center mr-3">
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <Text className="flex-1 text-sm font-medium text-ink dark:text-[#F2F2F2]">{label}</Text>
      {value && <Text className="text-sm text-muted dark:text-[#B3B3B3] mr-2">{value}</Text>}
      {chevron && <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />}
    </HStack>
  );
  return onPress ? (
    <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {row}
    </Tappable>
  ) : row;
}
