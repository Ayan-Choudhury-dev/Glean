import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGleanStore } from '../../store/useGleanStore';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Button, ButtonText } from '@/components/ui/button';

export default function ProfileScreen() {
  const { inventory, importCSV, signOut } = useGleanStore();
  const router = useRouter();

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

  const handleExport = () => {
    const header = 'Name,Quantity,Category,Location';
    const rows = inventory.map(
      i => `${i.name},${i.qty},${i.category},${i.location ?? ''}`
    );
    const csv = [header, ...rows].join('\n');
    // In production: use expo-sharing or expo-file-system to write + share the file.
    Alert.alert('Export preview', csv.slice(0, 400) + (csv.length > 400 ? '\n…' : ''));
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 48 }}>

      {/* Header */}
      <View className="bg-white px-6 pt-14 pb-5 border-b border-gray-100">
        <Heading size="xl">More settings</Heading>
      </View>

      {/* ── Household ──────────────────────────────────────────────────── */}
      <SectionHeader title="Household" />
      <Card>
        <SettingRow icon="home-outline" label="House name" value="My Home" />
        <Divider />
        <SettingRow icon="people-outline" label="Members" value="1 member" />
        <Divider />
        <Pressable>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center mr-3">
              <Ionicons name="person-add-outline" size={16} color="#475569" />
            </View>
            <Text className="flex-1 text-sm font-medium text-slate-600">Invite a member</Text>
            <Text className="text-xs text-slate-400">Coming soon</Text>
          </HStack>
        </Pressable>
      </Card>

      {/* ── CSV Import ─────────────────────────────────────────────────── */}
      <SectionHeader title="Import data" />
      <Card>
        <VStack className="p-4" space="sm">
          <Text className="text-xs text-slate-500">
            Paste a CSV with headers: <Text className="font-mono font-semibold">Name, Quantity, Category, Location</Text>
          </Text>
          <Text className="text-xs text-slate-400">
            Upsert logic: existing items get their quantity incremented; new items are created.
          </Text>
          <TextInput
            className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-gray-800 font-mono"
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            multiline
            placeholder={'Name,Quantity,Category,Location\nMilk,2,Dairy,Fridge\nRice,5,Grains,Pantry'}
            placeholderTextColor="#94A3B8"
            value={csvText}
            onChangeText={setCsvText}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Button
            size="sm"
            className="bg-slate-900 rounded-lg"
            onPress={handleImport}
            disabled={importing}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <ButtonText className="text-white">Import CSV</ButtonText>
          </Button>
        </VStack>
      </Card>

      {/* ── Export ─────────────────────────────────────────────────────── */}
      <SectionHeader title="Export data" />
      <Card>
        <Pressable onPress={handleExport}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center mr-3">
              <Ionicons name="download-outline" size={16} color="#475569" />
            </View>
            <VStack className="flex-1">
              <Text className="text-sm font-medium text-gray-900">Export inventory</Text>
              <Text className="text-xs text-gray-400">{inventory.length} items · CSV format</Text>
            </VStack>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </HStack>
        </Pressable>
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
        <Pressable onPress={handleSignOut}>
          <HStack className="items-center px-4 py-3">
            <View className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center mr-3">
              <Ionicons name="log-out-outline" size={16} color="#EF4444" />
            </View>
            <Text className="flex-1 text-sm font-medium text-red-500">Sign out</Text>
          </HStack>
        </Pressable>
      </Card>

    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest px-6 pt-5 pb-2">
      {title}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="mx-4 bg-white rounded-xl border border-gray-100 overflow-hidden">
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
