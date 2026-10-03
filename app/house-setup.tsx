import React, { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGleanStore } from '../store/useGleanStore';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { theme } from '@/constants/theme';

type Mode = 'pick' | 'create' | 'join';

export default function HouseSetupScreen() {
  const { profile, createHouse, joinHouse } = useGleanStore();
  const [mode,        setMode]        = useState<Mode>('pick');
  const [houseName,   setHouseName]   = useState('');
  const [inviteCode,  setInviteCode]  = useState('');
  const [busy,        setBusy]        = useState(false);

  const handleCreate = async () => {
    if (!houseName.trim()) return;
    setBusy(true);
    const result = await createHouse(houseName.trim());
    setBusy(false);

    if (typeof result === 'string') {
      Alert.alert('Error', result);
      return;
    }

    Alert.alert(
      'House created!',
      `Share this invite code with housemates:\n\n${result.invite_code}`,
      [{ text: "Let's go", onPress: () => router.replace('/(tabs)') }]
    );
  };

  const handleJoin = async () => {
    if (inviteCode.length < 6) return;
    setBusy(true);
    const success = await joinHouse(inviteCode.trim());
    setBusy(false);

    if (success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Code not found', 'Double-check the invite code and try again.');
    }
  };

  if (mode === 'create') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-8 justify-center">
          <BackButton onPress={() => setMode('pick')} />
          <Heading size="xl" className="mb-2 mt-4">Name your household</Heading>
          <Text className="text-slate-400 text-sm mb-8">You can invite housemates after setup.</Text>
          <VStack space="md">
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-base text-slate-900"
              placeholder="e.g. The Choudhury Home"
              placeholderTextColor={theme.colors.textFaint}
              value={houseName}
              onChangeText={setHouseName}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <Button size="lg" className="bg-emerald-600 rounded-xl" onPress={handleCreate} disabled={busy || !houseName.trim()}>
              <ButtonText className="text-white">{busy ? 'Creating…' : 'Create house'}</ButtonText>
            </Button>
          </VStack>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (mode === 'join') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-8 justify-center">
          <BackButton onPress={() => setMode('pick')} />
          <Heading size="xl" className="mb-2 mt-4">Join a household</Heading>
          <Text className="text-slate-400 text-sm mb-8">Ask a housemate for their 6-character invite code.</Text>
          <VStack space="md">
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-base text-slate-900 tracking-widest uppercase font-mono"
              placeholder="ABC123"
              placeholderTextColor={theme.colors.textFaint}
              value={inviteCode}
              onChangeText={v => setInviteCode(v.toUpperCase())}
              autoFocus
              autoCorrect={false}
              autoCapitalize="characters"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
            <Button size="lg" className="bg-emerald-600 rounded-xl" onPress={handleJoin} disabled={busy || inviteCode.length < 6}>
              <ButtonText className="text-white">{busy ? 'Joining…' : 'Join house'}</ButtonText>
            </Button>
          </VStack>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View className="flex-1 bg-white px-8 justify-center">
      <View className="items-center mb-10">
        <View className="w-16 h-16 bg-slate-100 rounded-2xl items-center justify-center mb-4">
          <Ionicons name="home-outline" size={32} color={theme.colors.textMuted} />
        </View>
        <Heading size="xl" className="text-center">Set up your household</Heading>
        <Text className="text-slate-400 text-sm mt-2 text-center">
          Hi {profile?.name}! Create a new home or join an existing one.
        </Text>
      </View>
      <VStack space="md">
        <OptionCard icon="add-circle-outline" title="Create a house"   subtitle="Start fresh and invite housemates" onPress={() => setMode('create')} />
        <OptionCard icon="enter-outline"      title="Join a house"     subtitle="Enter an invite code from a housemate"   onPress={() => setMode('join')} />
      </VStack>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Button size="sm" variant="link" action="secondary" onPress={onPress} className="self-start -ml-2">
      <Ionicons name="arrow-back" size={18} color={theme.colors.textMuted} />
      <ButtonText className="text-slate-500 ml-1">Back</ButtonText>
    </Button>
  );
}

function OptionCard({ icon, title, subtitle, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <Button size="lg" variant="outline" action="secondary" className="rounded-xl border-slate-200 h-auto py-4" onPress={onPress}>
      <HStack className="items-center flex-1 px-1">
        <View className="w-10 h-10 bg-slate-100 rounded-xl items-center justify-center mr-4">
          <Ionicons name={icon} size={20} color={theme.colors.textMuted} />
        </View>
        <VStack className="flex-1 items-start">
          <ButtonText className="text-slate-900 font-semibold text-base">{title}</ButtonText>
          <Text className="text-slate-400 text-xs">{subtitle}</Text>
        </VStack>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.borderStrong} />
      </HStack>
    </Button>
  );
}
