import React, { useMemo, useState, useEffect } from 'react';
import { View, TextInput, ScrollView, Linking, RefreshControl, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
import { getServerConfig } from '@/lib/serverConfig';
import { showDialog, showToast } from '@/lib/overlay';
import { HouseAvatar } from '@/components/HouseAvatar';
import { initialsFor } from '@/lib/initials';
import { HOUSE_IMAGES } from '@/constants/houseImages';

export default function ProfileScreen() {
  const { profile, house, inventory, importCSV, signOut, loadHouseData, setAvatar, setName, renameHouse, leaveHouse, setHouseImage } = useGleanStore();
  const colors = useColors();
  const appearanceMode = useAppearance(s => s.mode);
  const setAppearanceMode = useAppearance(s => s.setMode);
  const accentKey = useAppearance(s => s.accent);
  const setAccentKey = useAppearance(s => s.setAccent);
  const [serverConnected, setServerConnected] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    getServerConfig().then(cfg => setServerConnected(!!cfg));
  }, []);
  const [renameText, setRenameText] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const [nameText, setNameText] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
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

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showDialog({ title: 'Permission needed', message: 'Allow photo access to set your profile photo.', cancelLabel: null });
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
    showDialog({
      title: 'Sign out',
      message: 'Are you sure?',
      confirmLabel: 'Sign out',
      destructive: true,
      onConfirm: async () => {
        await signOut();
        router.replace('/onboarding');
      },
    });
  };
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const handleRename = async () => {
    const name = renameText.trim();
    if (!name) return;
    setRenameOpen(false);
    await renameHouse(name);
  };

  const handleSaveName = () => {
    const name = nameText.trim();
    if (!name) return;
    setNameOpen(false);
    setName(name);
    showToast('Name updated');
  };

  const handlePickImage = async (key: string) => {
    setImageOpen(false);
    const ok = await setHouseImage(key);
    if (ok) showToast('House image updated');
  };

  const handleLeave = () => {
    showDialog({
      title: 'Reset pantry',
      message: 'This clears your pantry on this device and starts fresh.',
      confirmLabel: 'Reset',
      destructive: true,
      onConfirm: async () => {
        await leaveHouse();
        router.replace('/house-setup');
      },
    });
  };

  const memberCount = house?.members?.length ?? 1;
  const membersLabel = memberCount === 1 ? '1 member' : `${memberCount} members`;
  const isOwner = !!house && house.owner_id === profile?.id;

  // Items per storage location, for the visualizer.
  const locationStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of inventory) {
      const key = item.location?.trim() || 'No location';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);
  }, [inventory]);
  const maxLocationCount = Math.max(1, ...locationStats.map(s => s.count));

  const handleImport = () => {
    if (!csvText.trim()) {
      showDialog({ title: 'Empty input', message: 'Paste your CSV content first.', cancelLabel: null });
      return;
    }
    setImporting(true);
    try {
      const { added, updated } = importCSV(csvText);
      setCsvText('');
      showDialog({
        title: 'Import complete',
        message: `${added} item${added !== 1 ? 's' : ''} added, ${updated} item${updated !== 1 ? 's' : ''} updated.`,
        cancelLabel: null,
      });
    } catch {
      showDialog({ title: 'Parse error', message: 'Could not read the CSV. Check the format and try again.', cancelLabel: null });
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
        showDialog({ title: 'Export unavailable', message: 'Sharing is not supported on this platform.', cancelLabel: null });
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
      showDialog({ title: 'Export failed', message: 'Could not export your inventory. Please try again.', cancelLabel: null });
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
        <Tappable
          onPress={() => { setNameText(profile?.name ?? ''); setNameOpen(true); }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Edit your name"
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
        </Tappable>
      </View>

      {/* ── Household ──────────────────────────────────────────────────── */}
      <SectionHeader title="Household" />
      <Card>
        {/* House identity */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
          <HouseAvatar imageKey={house?.image_key} size={56} radius={theme.radii.lg} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ flexShrink: 1, fontSize: theme.type.title, fontFamily: theme.fonts.medium, color: colors.text }} numberOfLines={1}>
                {house?.name ?? 'No house'}
              </Text>
              {isOwner && (
                <Tappable
                  onPress={() => { setRenameText(house?.name ?? ''); setRenameOpen(true); }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Rename household"
                  style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="pencil-outline" size={15} color={colors.textMuted} />
                </Tappable>
              )}
            </View>
          </View>
        </View>
        <Divider />
        <SettingRow
          icon="image-outline"
          label="House image"
          value={HOUSE_IMAGES.find(p => p.key === house?.image_key)?.label ?? 'Default'}
          onPress={() => setImageOpen(true)}
        />
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

      {/* ── Server ─────────────────────────────────────────────────────── */}
      <SectionHeader title="Server" />
      <Card>
        <SettingRow
          icon="cloud-outline"
          label="Self-hosted backend"
          value={serverConnected ? 'Connected' : 'Not connected'}
          onPress={() => router.push('/server')}
        />
      </Card>

      {/* ── Account ────────────────────────────────────────────────────── */}
      <SectionHeader title="Account" />
      <Card>
        <Tappable onPress={handleLeave}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-surfaceMuted dark:bg-[#2A2A2A] items-center justify-center mr-3">
              <Ionicons name="exit-outline" size={16} color={colors.textMuted} />
            </View>
            <Text className="flex-1 text-sm font-medium text-muted dark:text-[#B3B3B3]">Reset pantry</Text>
          </HStack>
        </Tappable>
        <Divider />
        <Tappable onPress={handleSignOut}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-red-50 dark:bg-[#3A1E1E] items-center justify-center mr-3">
              <Ionicons name="log-out-outline" size={16} color={colors.danger} />
            </View>
            <Text className="flex-1 text-sm font-medium text-red-500 dark:text-[#FF6B6B]">Sign out</Text>
          </HStack>
        </Tappable>
      </Card>

      {/* ── Storage by location ─────────────────────────────────────────── */}
      {locationStats.length > 0 && (
        <>
          <SectionHeader title="Storage" />
          <Card>
            <View style={{ padding: 16, gap: 14 }}>
              {locationStats.map(({ location, count }) => (
                <View key={location} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ flexShrink: 1, fontSize: theme.type.label, fontWeight: '600', color: colors.text }} numberOfLines={1}>{location}</Text>
                    <Text style={{ fontSize: theme.type.caption, color: colors.textMuted, marginLeft: 8 }}>{count} {count === 1 ? 'item' : 'items'}</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: theme.radii.pill, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round((count / maxLocationCount) * 100)}%`, height: '100%', borderRadius: theme.radii.pill, backgroundColor: colors.accent }} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      {/* Rename household sheet */}
      <NativeSheet visible={renameOpen} onClose={() => setRenameOpen(false)}>
        <VStack className="px-6 pt-2 pb-10" space="lg">
          <VStack space="xs">
            <Heading size="md">Household name</Heading>
            <Text className="text-sm text-muted dark:text-[#B3B3B3]">This is what members see across Glean.</Text>
          </VStack>
          <TextInput
            className="bg-surfaceMuted dark:bg-[#2A2A2A] border border-line dark:border-[#333333] rounded-xl px-4 h-12 text-base text-ink dark:text-[#F2F2F2]"
            style={{ fontFamily: theme.fonts.regular }}
            placeholder="e.g. The Choudhury Home"
            placeholderTextColor={colors.textFaint}
            value={renameText}
            onChangeText={setRenameText}
            autoFocus
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleRename}
          />
          <Button size="lg" className="bg-brand rounded-xl" onPress={handleRename} disabled={!renameText.trim()}>
            <ButtonText className="text-white">Save name</ButtonText>
          </Button>
        </VStack>
      </NativeSheet>

      {/* Your name sheet */}
      <NativeSheet visible={nameOpen} onClose={() => setNameOpen(false)}>
        <VStack className="px-6 pt-2 pb-10" space="lg">
          <VStack space="xs">
            <Heading size="md">Your name</Heading>
            <Text className="text-sm text-muted dark:text-[#B3B3B3]">Shown to everyone in your household.</Text>
          </VStack>
          <TextInput
            className="bg-surfaceMuted dark:bg-[#2A2A2A] border border-line dark:border-[#333333] rounded-xl px-4 h-12 text-base text-ink dark:text-[#F2F2F2]"
            style={{ fontFamily: theme.fonts.regular }}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            value={nameText}
            onChangeText={setNameText}
            autoFocus
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
          />
          <Button size="lg" className="bg-brand rounded-xl" onPress={handleSaveName} disabled={!nameText.trim()}>
            <ButtonText className="text-white">Save</ButtonText>
          </Button>
        </VStack>
      </NativeSheet>

      {/* House image sheet */}
      <NativeSheet visible={imageOpen} onClose={() => setImageOpen(false)}>
        <VStack className="px-6 pt-2 pb-10" space="lg">
          <VStack space="xs">
            <Heading size="md">House image</Heading>
            <Text className="text-sm text-muted dark:text-[#B3B3B3]">Shown to everyone in the household.</Text>
          </VStack>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {HOUSE_IMAGES.map(preset => {
              const selected = house?.image_key === preset.key;
              return (
                <Tappable
                  key={preset.key}
                  onPress={() => handlePickImage(preset.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`House image ${preset.label}`}
                  style={{ alignItems: 'center', width: 88 }}
                >
                  <View style={{ borderWidth: selected ? 3 : 0, borderColor: colors.accent, borderRadius: theme.radii.lg, padding: 2 }}>
                    <HouseAvatar imageKey={preset.key} size={64} radius={theme.radii.md} />
                  </View>
                </Tappable>
              );
            })}
          </View>
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
    <Text style={{ fontSize: theme.type.xl, color: colors.primary, fontFamily: theme.fonts.display, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>{title}</Text>
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
