import React, { useState, useRef } from 'react';
import {
  Alert,
  Animated,
  View,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGleanStore } from '../store/useGleanStore';

import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Button, ButtonText } from '@/components/ui/button';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';

const CATEGORIES = [
  'Dairy', 'Grains', 'Spices', 'Vegetables', 'Fruits',
  'Meat & Fish', 'Beverages', 'Snacks', 'Cleaning', 'Personal Care', 'Other',
];

const LOCATIONS = [
  'Fridge', 'Freezer', 'Pantry', 'Cupboard', 'Kitchen',
  'Kitchen cabinet', 'Counter', 'Bathroom', 'Other',
];

export default function ItemFormScreen() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { inventory, consumptionLogs, addInventoryItem, editInventoryItem, deleteInventoryItem,
          addToShoppingList, logConsumption } = useGleanStore();

  const existing = itemId ? inventory.find(i => i.id === itemId) : null;
  const isEdit   = !!existing;

  const [name,     setName]     = useState(existing?.name     ?? '');
  const [qty,      setQty]      = useState(String(existing?.qty ?? ''));
  const [category, setCategory] = useState(existing?.category ?? '');
  const [location, setLocation] = useState(existing?.location  ?? '');

  const isDirty = isEdit
    ? name.trim() !== (existing?.name ?? '') ||
      (parseInt(qty, 10) || 0) !== (existing?.qty ?? 0) ||
      category !== (existing?.category ?? '') ||
      location !== (existing?.location ?? '')
    : name.trim().length > 0;

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState('');

  const showToastAndDismiss = (msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => router.dismiss());
  };

  const [categorySheet,  setCategorySheet]  = useState(false);
  const [locationSheet,  setLocationSheet]  = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [zeroQtySheet,   setZeroQtySheet]   = useState(false);
  const [pendingZeroQty, setPendingZeroQty] = useState<{
    itemId: string; itemName: string; prevQty: number;
  } | null>(null);

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Please enter an item name.');
      return;
    }

    // Duplicate check — skip when editing and name hasn't changed
    const duplicate = inventory.find(
      i => i.name.toLowerCase() === trimmedName.toLowerCase() && i.id !== existing?.id
    );
    if (duplicate) {
      Alert.alert('Already exists', `"${trimmedName}" is already in your inventory.`);
      return;
    }

    const parsedQty = Math.max(0, parseInt(qty, 10) || 0);

    if (isEdit && existing) {
      const prevQty = existing.qty;
      editInventoryItem(existing.id, {
        name:     trimmedName,
        qty:      parsedQty,
        category: category || 'Other',
        location: location.trim() || undefined,
      });

      // Zero-qty trigger: item went from >0 to 0 via edit
      if (prevQty > 0 && parsedQty === 0) {
        setPendingZeroQty({ itemId: existing.id, itemName: trimmedName, prevQty });
        setZeroQtySheet(true);
      } else {
        if (parsedQty < prevQty) {
          logConsumption(existing.id, trimmedName, prevQty - parsedQty, 'used');
        } else if (parsedQty > prevQty) {
          logConsumption(existing.id, trimmedName, parsedQty - prevQty, 'restocked');
        }
        showToastAndDismiss('Changes saved');
      }
    } else {
      const newId = addInventoryItem({
        name:     trimmedName,
        qty:      parsedQty,
        category: category || 'Other',
        location: location.trim() || undefined,
      });
      if (parsedQty > 0) logConsumption(newId, trimmedName, parsedQty, 'added');
      showToastAndDismiss('Item added');
    }
  };

  // ── Zero-qty sheet actions ───────────────────────────────────────────────────

  const handleZeroQtyNotNow = () => {
    if (pendingZeroQty) logConsumption(pendingZeroQty.itemId, pendingZeroQty.itemName, pendingZeroQty.prevQty);
    setZeroQtySheet(false);
    router.dismiss();
  };

  const handleZeroQtyAddToList = () => {
    if (pendingZeroQty) {
      logConsumption(pendingZeroQty.itemId, pendingZeroQty.itemName, pendingZeroQty.prevQty);
      addToShoppingList(pendingZeroQty.itemName, pendingZeroQty.itemId);
    }
    setZeroQtySheet(false);
    router.dismiss();
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (!existing) return;
    setDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!existing) return;
    setDeleteConfirm(false);
    deleteInventoryItem(existing.id);
    router.dismiss();
  };

  // ── UI ──────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <HStack className="items-center px-4 pt-14 pb-4 gap-2">
        <Pressable onPress={() => router.dismiss()} hitSlop={12} className="w-9 h-9 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </Pressable>
        <Heading size="lg" className="flex-1 text-gray-900">
          {isEdit ? existing!.name : 'Add new item'}
        </Heading>
        <Pressable
          onPress={handleSave}
          disabled={!isDirty}
          hitSlop={12}
          className={`px-4 h-9 rounded-xl items-center justify-center ${isDirty ? 'bg-slate-900' : 'bg-slate-200'}`}
        >
          <Text className={`text-sm font-semibold ${isDirty ? 'text-white' : 'text-slate-400'}`}>Save</Text>
        </Pressable>
      </HStack>

      <ScrollView
        className="flex-1 px-6"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <VStack space="lg">
          {/* Low-stock suggestion */}
          {isEdit && (parseInt(qty, 10) || 0) === 1 && (
            <View className="mt-2 flex-row items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
              <Ionicons name="alert-circle-outline" size={20} color="#D97706" style={{ marginTop: 1 }} />
              <VStack className="flex-1" space="xs">
                <Text className="text-sm font-semibold text-amber-800">Running low</Text>
                <Text className="text-xs text-amber-700 leading-5">
                  Only 1 left — consider restocking soon.
                </Text>
                <Pressable
                  className="mt-2 self-start bg-amber-600 rounded-lg px-3 py-1.5"
                  onPress={() => {
                    addToShoppingList(existing!.name, existing!.id);
                    router.dismiss();
                  }}
                >
                  <Text className="text-xs font-semibold text-white">Add to shopping list</Text>
                </Pressable>
              </VStack>
            </View>
          )}

          {/* Item name */}
          <Field label="Item name">
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-12 text-sm text-gray-900"
              placeholder='"Atta" or "Rice"'
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoFocus={!isEdit}
              autoCorrect={false}
            />
          </Field>

          {/* Category — picker */}
          <Field label="Category">
            <Pressable
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-12 flex-row items-center"
              onPress={() => setCategorySheet(true)}
            >
              <Text
                className={`flex-1 text-sm ${category ? 'text-gray-900' : 'text-gray-400'}`}
              >
                {category || 'Select a category'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </Pressable>
          </Field>

          {/* Location — picker */}
          <Field label="Location">
            <Pressable
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-12 flex-row items-center"
              onPress={() => setLocationSheet(true)}
            >
              <Text
                className={`flex-1 text-sm ${location ? 'text-gray-900' : 'text-gray-400'}`}
              >
                {location || 'Where is it stored?'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </Pressable>
          </Field>

          {/* Quantity */}
          <View className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mt-2">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Quantity</Text>
            <HStack className="items-center justify-between">
              <Pressable
                className="w-14 h-14 rounded-full bg-white border border-gray-200 items-center justify-center"
                onPress={() => setQty(String(Math.max(0, (parseInt(qty, 10) || 0) - 1)))}
                disabled={(parseInt(qty, 10) || 0) === 0}
                style={{ opacity: (parseInt(qty, 10) || 0) === 0 ? 0.3 : 1 }}
              >
                <Ionicons name="remove" size={22} color="#374151" />
              </Pressable>
              <Text className="text-4xl font-bold text-gray-900">
                {parseInt(qty, 10) || 0}
              </Text>
              <Pressable
                className="w-14 h-14 rounded-full bg-slate-900 items-center justify-center"
                onPress={() => setQty(String((parseInt(qty, 10) || 0) + 1))}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </HStack>
          </View>

          

          {/* Recent Activity */}
          {isEdit && (() => {
            const logs = consumptionLogs
              .filter(l => l.inventory_id === existing!.id)
              .sort((a, b) => new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime())
              .slice(0, 8);
            if (logs.length === 0) return null;
            return (
              <View className="mt-2 rounded-2xl overflow-hidden border border-slate-200">
                <View className="bg-gray-100 px-4 justify-center" style={{ height: 36 }}>
                  <Text className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recent Activity</Text>
                </View>
                {logs.map((log, i) => {
                  const action = log.action ?? 'used';
                  const dotColor =
                    action === 'added'     ? '#3B82F6' :
                    action === 'restocked' ? '#10B981' : '#141C2D';
                  const label =
                    action === 'added'     ? `Added ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                    action === 'restocked' ? `Restocked ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                                            `Used ${log.qty} unit${log.qty !== 1 ? 's' : ''}`;
                  return (
                    <View
                      key={log.id}
                      className={`bg-white px-4 flex-row items-center${i < logs.length - 1 ? ' border-b border-slate-200' : ''}`}
                      style={{ height: 56 }}
                    >
                      <View className="w-6 h-6 items-center justify-center mr-3">
                        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                      </View>
                      <VStack className="flex-1">
                        <Text className="text-sm text-slate-900 font-medium">{label}</Text>
                        <Text className="text-xs text-slate-500">{formatActivityDate(log.consumed_at)}</Text>
                      </VStack>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Delete item — inside scroll so it doesn't float */}
          {isEdit && (
            <Button
              size="lg"
              variant="outline"
              action="negative"
              className="rounded-xl border-red-200 mt-2"
              onPress={handleDelete}
            >
              <ButtonText className="text-red-500">Delete item</ButtonText>
            </Button>
          )}

        </VStack>
      </ScrollView>

      {/* Cancel footer — new item only */}
      {!isEdit && (
        <VStack className="px-6 pb-8 pt-3 border-t border-gray-100">
          <Button
            size="lg"
            variant="outline"
            action="secondary"
            className="rounded-xl"
            onPress={() => router.dismiss()}
          >
            <ButtonText>Cancel</ButtonText>
          </Button>
        </VStack>
      )}

      {/* Category bottom sheet */}
      <PickerSheet
        visible={categorySheet}
        title="Category"
        options={CATEGORIES}
        selected={category}
        onSelect={v => { setCategory(v); setCategorySheet(false); }}
        onClose={() => setCategorySheet(false)}
      />

      {/* Location bottom sheet */}
      <PickerSheet
        visible={locationSheet}
        title="Location"
        options={LOCATIONS}
        selected={location}
        onSelect={v => { setLocation(v); setLocationSheet(false); }}
        onClose={() => setLocationSheet(false)}
      />

      {/* Zero-qty shopping list sheet */}
      <Modal visible={zeroQtySheet} transparent animationType="slide" onRequestClose={handleZeroQtyNotNow}>
        <Pressable className="flex-1 bg-black/40" onPress={handleZeroQtyNotNow} />
        <View className="bg-white rounded-t-2xl">
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 bg-gray-300 rounded-full" />
          </View>
          <VStack className="px-6 pt-4 pb-10" space="lg">
            <VStack space="xs">
              <Heading size="md">Item finished!</Heading>
              <Text className="text-sm text-gray-500">
                Add {pendingZeroQty?.itemName} to your shopping list?
              </Text>
            </VStack>
            <VStack space="sm">
              <Button size="lg" className="bg-slate-900 rounded-xl" onPress={handleZeroQtyAddToList}>
                <ButtonText className="text-white">Add to shopping list</ButtonText>
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl" onPress={handleZeroQtyNotNow}>
                <ButtonText>Not now</ButtonText>
              </Button>
            </VStack>
          </VStack>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <Modal visible={deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(false)}>
        <Pressable className="flex-1 bg-black/40 items-center justify-center" onPress={() => setDeleteConfirm(false)}>
          <Pressable className="bg-white rounded-2xl mx-8 p-6 w-72" onPress={() => {}}>
            <Text className="text-base font-semibold text-gray-900 mb-2">
              Delete "{existing?.name}"?
            </Text>
            <Text className="text-sm text-gray-500 mb-6">
              This will also remove it from your shopping list.
            </Text>
            <VStack space="sm">
              <Button size="md" className="bg-red-500 rounded-xl" onPress={confirmDelete}>
                <ButtonText className="text-white">Delete</ButtonText>
              </Button>
              <Button size="md" variant="outline" className="rounded-xl" onPress={() => setDeleteConfirm(false)}>
                <ButtonText>Cancel</ButtonText>
              </Button>
            </VStack>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Toast */}
      <Animated.View
        pointerEvents="none"
        style={{ opacity: toastOpacity }}
        className="absolute bottom-28 left-6 right-6 items-center"
      >
        <View className="bg-slate-900 rounded-xl px-5 py-3 flex-row items-center gap-2">
          <Ionicons name="checkmark-circle" size={16} color="#34D399" />
          <Text className="text-white text-sm font-medium">{toastMsg}</Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  const now  = Date.now();
  const diff = now - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <VStack space="xs">
      <Text className="text-sm font-semibold text-gray-700">{label}</Text>
      {children}
    </VStack>
  );
}

// ─── Bottom sheet picker ──────────────────────────────────────────────────────

function PickerSheet({
  visible, title, options, selected, onSelect, onClose,
}: {
  visible:  boolean;
  title:    string;
  options:  string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose:  () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-white rounded-t-2xl">
        {/* Handle */}
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 bg-gray-300 rounded-full" />
        </View>

        {/* Title */}
        <HStack className="items-center px-6 py-4">
          <Text className="flex-1 text-base font-semibold text-gray-900">{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </HStack>

        {/* Options */}
        <FlatList
          data={options}
          keyExtractor={item => item}
          style={{ maxHeight: 360 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-6" />}
          renderItem={({ item }) => (
            <Pressable
              className="flex-row items-center px-6 py-4"
              onPress={() => onSelect(item)}
            >
              <Text className="flex-1 text-sm text-gray-900">{item}</Text>
              {selected === item && (
                <Ionicons name="checkmark" size={18} color="#141C2D" />
              )}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}
