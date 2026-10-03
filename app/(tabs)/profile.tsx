import React, { useState } from 'react';
import { View, TextInput, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Tappable } from '../../components/ui/tappable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore } from '../../store/useGleanStore';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Button, ButtonText } from '@/components/ui/button';
import { NativeSheet } from '../../components/NativeSheet';

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
  const insets = useSafeAreaInsets();
  const { profile, house, inventory, importCSV, signOut } = useGleanStore();
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [dataSheetOpen, setDataSheetOpen] = useState(false);
  const [dataTab, setDataTab] = useState<'import' | 'export'>('import');
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
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <View style={{ height: 64 + insets.top, paddingTop: insets.top }}>
        <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#0F172A' }}>Profile</Text>
        </View>
      </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}>

      <View style={{ marginHorizontal: 24, marginTop: 16, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', padding: 16, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>{initialsFor(profile?.name ?? '')}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Signed in as</Text>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{profile?.name ?? 'User'}</Text>
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
            <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center mr-3">
              <Ionicons name="person-add-outline" size={16} color="#475569" />
            </View>
            <Text className="flex-1 text-sm font-medium text-slate-600">Invite a member</Text>
            <Text className="text-xs text-slate-400">Share invite code</Text>
          </HStack>
        </Tappable>
      </Card>

      {/* ── Data (import / export) ─────────────────────────────────────── */}
      <SectionHeader title="Data" />
      <Card>
        <Tappable onPress={() => setDataSheetOpen(true)}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center mr-3">
              <Ionicons name="swap-horizontal-outline" size={16} color="#475569" />
            </View>
            <VStack className="flex-1">
              <Text className="text-sm font-medium text-slate-600">Import / export data</Text>
              <Text className="text-xs text-slate-400">{inventory.length} items · CSV format</Text>
            </VStack>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </HStack>
        </Tappable>
      </Card>

      {/* ── About ──────────────────────────────────────────────────────── */}
      <SectionHeader title="About" />
      <Card>
        <SettingRow icon="information-circle-outline" label="App version" value="1.0.0" />
        <Divider />
        <SettingRow icon="help-circle-outline" label="Help & feedback" />
      </Card>

      {/* ── Account ────────────────────────────────────────────────────── */}
      <SectionHeader title="Account" />
      <Card>
        <Tappable onPress={handleSignOut}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center mr-3">
              <Ionicons name="log-out-outline" size={16} color="#EF4444" />
            </View>
            <Text className="flex-1 text-sm font-medium text-red-500">Sign out</Text>
          </HStack>
        </Tappable>
      </Card>

      {/* Invite sheet */}
      <NativeSheet visible={inviteSheetOpen} onClose={() => setInviteSheetOpen(false)}>
        <VStack className="px-6 pt-2 pb-10" space="lg">
          <VStack space="xs">
            <Heading size="md">Invite a member</Heading>
            <Text className="text-sm text-gray-500">
              Share this invite code with housemates so they can join{' '}
              {house?.name ?? 'your household'}.
            </Text>
          </VStack>
          <View className="bg-slate-100 border border-slate-200 rounded-xl py-6 items-center">
            <Text className="text-3xl font-bold text-slate-900 tracking-[0.3em]">
              {house?.invite_code ?? '—'}
            </Text>
          </View>
          <VStack space="sm">
            <Button size="lg" className="bg-slate-900 rounded-xl" onPress={() => setInviteSheetOpen(false)}>
              <ButtonText className="text-white">Got it</ButtonText>
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
              <Ionicons name="close" size={20} color="#6B7280" />
            </Tappable>
          </HStack>
          <HStack className="bg-slate-100 rounded-xl p-1">
            {(['import', 'export'] as const).map(tab => (
              <Tappable
                key={tab}
                className={`flex-1 py-2 rounded-lg items-center ${dataTab === tab ? 'bg-white' : ''}`}
                style={dataTab === tab ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 } : undefined}
                onPress={() => setDataTab(tab)}
              >
                <Text className={`text-sm font-semibold capitalize ${dataTab === tab ? 'text-slate-900' : 'text-slate-400'}`}>
                  {tab === 'import' ? 'Import' : 'Export'}
                </Text>
              </Tappable>
            ))}
          </HStack>

          {dataTab === 'import' ? (
            <VStack className="pt-4" space="sm">
              <Text className="text-xs text-slate-500">
                Paste a CSV with headers:{' '}
                <Text className="font-mono font-semibold">Name, Quantity, Category, Location</Text>
              </Text>
              <Text className="text-xs text-slate-400">
                Upsert logic: existing items get their quantity incremented; new items are created.
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-gray-800 font-mono"
                style={{ minHeight: 140, textAlignVertical: 'top' }}
                multiline
                placeholder={'Name,Quantity,Category,Location\nMilk,2,Dairy,Fridge\nRice,5,Grains,Pantry'}
                placeholderTextColor="#94A3B8"
                value={csvText}
                onChangeText={setCsvText}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Button
                size="md"
                className="bg-slate-900 rounded-xl mt-1"
                onPress={handleImport}
                disabled={importing}
              >
                <Ionicons name="cloud-upload-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <ButtonText className="text-white">{importing ? 'Importing…' : 'Import CSV'}</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack className="pt-4" space="sm">
              <Text className="text-xs text-slate-500">
                Your inventory will be exported as a CSV file you can back up or share.
              </Text>
              <Tappable className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2">
                <Text className="text-xs text-slate-400 font-mono" numberOfLines={2}>
                  Name,Quantity,Category,Location · {inventory.length} rows
                </Text>
              </Tappable>
              <Button
                size="md"
                className="bg-slate-900 rounded-xl mt-1"
                onPress={() => { setDataSheetOpen(false); handleExport(); }}
              >
                <Ionicons name="download-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <ButtonText className="text-white">Export inventory</ButtonText>
              </Button>
            </VStack>
          )}
        </View>
      </NativeSheet>

    </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 20, fontWeight: '600', color: '#0F172A', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>{title}</Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: 24, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' }}>
      {children}
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-gray-100 ml-[52px]" />;
}

function SettingRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
}) {
  return (
    <HStack className="items-center px-4 py-3">
      <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center mr-3">
        <Ionicons name={icon} size={16} color="#475569" />
      </View>
      <Text className="flex-1 text-sm font-medium text-gray-900">{label}</Text>
      {value && <Text className="text-sm text-gray-400 mr-2">{value}</Text>}
      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
    </HStack>
  );
}
