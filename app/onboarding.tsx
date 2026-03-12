import React, { useState, useEffect } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGleanStore } from '../store/useGleanStore';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';

type Mode = 'sign_up' | 'sign_in';

export default function OnboardingScreen() {
  const { profile, signUp, signIn, signInWithMagicLink } = useGleanStore();
  const [mode,     setMode]     = useState<Mode>('sign_up');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Already authenticated — skip onboarding
  useEffect(() => {
    if (profile) {
      router.replace(profile.house_id ? '/(tabs)' : '/house-setup');
    }
  }, []);

  if (profile) return null;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    if (mode === 'sign_up' && !name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }

    setBusy(true);
    const error =
      mode === 'sign_up'
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);
    setBusy(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    const { profile: p } = useGleanStore.getState();
    router.replace(p?.house_id ? '/(tabs)' : '/house-setup');
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email.');
      return;
    }
    setBusy(true);
    const error = await signInWithMagicLink(email.trim());
    setBusy(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }
    setMagicLinkSent(true);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 px-8 justify-center">

        {/* App mark */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 bg-slate-900 rounded-2xl items-center justify-center mb-4">
            <Ionicons name="cube" size={40} color="#fff" />
          </View>
          <Heading size="2xl">Glean</Heading>
          <Text className="text-gray-400 text-sm mt-1">Your household inventory</Text>
        </View>

        {/* Mode toggle */}
        <HStack className="bg-slate-100 rounded-xl p-1 mb-6">
          {(['sign_up', 'sign_in'] as Mode[]).map(m => (
            <Pressable
              key={m}
              className={`flex-1 py-2 rounded-lg items-center ${mode === m ? 'bg-white shadow-sm' : ''}`}
              onPress={() => setMode(m)}
            >
              <Text className={`text-sm font-semibold ${mode === m ? 'text-slate-900' : 'text-slate-400'}`}>
                {m === 'sign_up' ? 'Sign up' : 'Sign in'}
              </Text>
            </Pressable>
          ))}
        </HStack>

        <VStack space="md">
          {mode === 'sign_up' && (
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-12 text-sm text-gray-900"
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
            />
          )}

          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-12 text-sm text-gray-900"
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View className="relative">
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 pr-12 h-12 text-sm text-gray-900"
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
            />
            <Pressable
              className="absolute right-4 top-3"
              onPress={() => setShowPwd(v => !v)}
            >
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          <Button
            size="lg"
            className="bg-slate-900 rounded-xl mt-2"
            onPress={handleSubmit}
            disabled={busy}
          >
            <ButtonText className="text-white">
              {busy ? 'Please wait…' : mode === 'sign_up' ? 'Create account' : 'Sign in'}
            </ButtonText>
          </Button>

          {/* Divider */}
          <HStack className="items-center my-2">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-4 text-xs text-gray-400">or</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </HStack>

          {/* Magic link */}
          {magicLinkSent ? (
            <VStack className="items-center py-4" space="sm">
              <Ionicons name="mail-outline" size={28} color="#475569" />
              <Text className="text-sm font-semibold text-slate-700">Check your email</Text>
              <Text className="text-xs text-slate-400 text-center">
                We sent a sign-in link to {email}
              </Text>
              <Pressable onPress={() => setMagicLinkSent(false)}>
                <Text className="text-xs text-blue-500 mt-1">Use a different email</Text>
              </Pressable>
            </VStack>
          ) : (
            <Pressable
              className="flex-row items-center justify-center bg-white border border-gray-200 rounded-xl h-12"
              onPress={handleMagicLink}
              disabled={busy}
            >
              <Ionicons name="mail-outline" size={18} color="#475569" />
              <Text className="ml-2 text-sm font-semibold text-gray-700">
                Sign in with magic link
              </Text>
            </Pressable>
          )}

          {__DEV__ && (
            <Pressable onPress={() => router.replace('/(tabs)')} className="items-center py-2">
              <Text className="text-xs text-gray-400 underline">Skip (dev only)</Text>
            </Pressable>
          )}
        </VStack>
      </View>
    </KeyboardAvoidingView>
  );
}
