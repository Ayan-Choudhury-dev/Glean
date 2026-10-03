import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  Animated,
  View,
  Text,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeSheet } from '../components/NativeSheet';
import { DEFAULT_HOUSE_OPTIONS, HouseOption, HouseOptionType, useGleanStore } from '../store/useGleanStore';

export default function ItemFormScreen() {
  const insets = useSafeAreaInsets();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { inventory, consumptionLogs, addInventoryItem, editInventoryItem, deleteInventoryItem,
          addToShoppingList, logConsumption, houseOptions, addHouseOption, shoppingList } = useGleanStore();

  const existing = itemId ? inventory.find(i => i.id === itemId) : null;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [qty, setQty] = useState(String(existing?.qty ?? ''));
  const [category, setCategory] = useState(existing?.category ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');

  const isDirty = isEdit
    ? name.trim() !== (existing?.name ?? '') ||
      (parseInt(qty, 10) || 0) !== (existing?.qty ?? 0) ||
      category !== (existing?.category ?? '') ||
      location !== (existing?.location ?? '')
    : name.trim().length > 0;

  const isInShoppingList = isEdit && shoppingList.some(s => s.inventory_id === existing?.id);

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

  const [categorySheet, setCategorySheet] = useState(false);
  const [locationSheet, setLocationSheet] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [zeroQtySheet, setZeroQtySheet] = useState(false);
  const [pendingZeroQty, setPendingZeroQty] = useState<{
    itemId: string; itemName: string; prevQty: number;
  } | null>(null);

  const availableOptions = useMemo<HouseOption[]>(() => {
    if (houseOptions.length > 0) return houseOptions;
    return DEFAULT_HOUSE_OPTIONS.map((option, index) => ({ ...option, id: `default-${index}`, house_id: '' }));
  }, [houseOptions]);

  const categoryOptions = availableOptions.filter(option => option.type === 'category');
  const locationOptions = availableOptions.filter(option => option.type === 'location');

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Please enter an item name.');
      return;
    }

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
        name: trimmedName,
        qty: parsedQty,
        category: category || 'Other',
        location: location.trim() || undefined,
      });

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
        name: trimmedName,
        qty: parsedQty,
        category: category || 'Other',
        location: location.trim() || undefined,
      });
      if (parsedQty > 0) logConsumption(newId, trimmedName, parsedQty, 'added');
      showToastAndDismiss('Item added');
    }
  };

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

  const handleDelete = () => {
    if (!existing) return;
    setDeleteConfirm(true);
  };

  const revertChanges = () => {
    setName(existing?.name ?? '');
    setQty(String(existing?.qty ?? ''));
    setCategory(existing?.category ?? '');
    setLocation(existing?.location ?? '');
  };

  const confirmDelete = () => {
    if (!existing) return;
    setDeleteConfirm(false);
    deleteInventoryItem(existing.id);
    router.dismiss();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <Pressable onPress={() => router.dismiss()} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '600', color: '#111827' }}>
            {isEdit ? existing!.name : 'Add new item'}
          </Text>
          {isEdit && (
            <Pressable onPress={handleDelete} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Low-stock suggestion */}
        {isEdit && (parseInt(qty, 10) || 0) === 1 && (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, padding: 16 }}>
            <Ionicons name="alert-circle-outline" size={20} color="#D97706" style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400E' }}>Running low</Text>
              <Text style={{ fontSize: 12, color: '#B45309', lineHeight: 20 }}>Only 1 left — consider restocking soon.</Text>
              {isInShoppingList ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Added to shopping list</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => { addToShoppingList(existing!.name, existing!.id); router.dismiss(); }}
                  style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#D97706', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Add to shopping list</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Out-of-stock suggestion */}
        {isEdit && (parseInt(qty, 10) || 0) === 0 && (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 16, padding: 16 }}>
            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#991B1B' }}>Out of stock</Text>
              <Text style={{ fontSize: 12, color: '#B91C1C', lineHeight: 20 }}>You've used all of {existing!.name}.</Text>
              {isInShoppingList ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Added to shopping list</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => { addToShoppingList(existing!.name, existing!.id); router.dismiss(); }}
                  style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Add to shopping list</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Item name */}
        <Field label="Item name">
          <TextInput
            style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 14, color: '#111827' }}
            placeholder='"Atta" or "Rice"'
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoFocus={!isEdit}
            autoCorrect={false}
          />
        </Field>

        {/* Category */}
        <Field label="Category">
          <Pressable
            onPress={() => setCategorySheet(true)}
            style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center' }}
          >
            {category && <Ionicons name={(categoryOptions.find(option => option.name === category)?.icon ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name']} size={18} color="#64748B" style={{ marginRight: 10 }} />}
            <Text style={{ flex: 1, fontSize: 14, color: category ? '#111827' : '#9CA3AF' }}>{category || 'Select a category'}</Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </Pressable>
        </Field>

        {/* Location */}
        <Field label="Location">
          <Pressable
            onPress={() => setLocationSheet(true)}
            style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center' }}
          >
            {location && <Ionicons name={(locationOptions.find(option => option.name === location)?.icon ?? 'location-outline') as React.ComponentProps<typeof Ionicons>['name']} size={18} color="#64748B" style={{ marginRight: 10 }} />}
            <Text style={{ flex: 1, fontSize: 14, color: location ? '#111827' : '#9CA3AF' }}>{location || 'Where is it stored?'}</Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </Pressable>
        </Field>

        {/* Quantity */}
        <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 20, marginTop: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Quantity</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={() => setQty(String(Math.max(0, (parseInt(qty, 10) || 0) - 1)))}
              disabled={(parseInt(qty, 10) || 0) === 0}
              style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', opacity: (parseInt(qty, 10) || 0) === 0 ? 0.3 : 1 }}
            >
              <Ionicons name="remove" size={22} color="#374151" />
            </Pressable>
            <Text style={{ fontSize: 32, fontWeight: '700', color: '#111827' }}>{parseInt(qty, 10) || 0}</Text>
            <Pressable
              onPress={() => setQty(String((parseInt(qty, 10) || 0) + 1))}
              style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Recent Activity */}
        {isEdit && (() => {
          const logs = consumptionLogs
            .filter(l => l.inventory_id === existing!.id)
            .sort((a, b) => new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime())
            .slice(0, 8);
          if (logs.length === 0) return null;
          return (
            <View style={{ marginTop: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 16, justifyContent: 'center', height: 36 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.5 }}>Recent Activity</Text>
              </View>
              {logs.map((log, i) => {
                const action = log.action ?? 'used';
                const dotColor = action === 'added' ? '#3B82F6' : action === 'restocked' ? '#10B981' : '#141C2D';
                const label = action === 'added' ? `Added ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                  action === 'restocked' ? `Restocked ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                    `Used ${log.qty} unit${log.qty !== 1 ? 's' : ''}`;
                return (
                  <View key={log.id} style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', height: 56, borderBottomWidth: i < logs.length - 1 ? 1 : 0, borderBottomColor: '#E2E8F0' }}>
                    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: dotColor }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: '500' }}>{label}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>{formatActivityDate(log.consumed_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </ScrollView>

      {/* Sticky footer — Save (left) + Revert changes (right) */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingBottom: insets.bottom + 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 10 }}>
        <Pressable
          onPress={handleSave}
          disabled={!isDirty}
          style={{
            flex: 1,
            backgroundColor: isDirty ? '#0F172A' : '#E2E8F0',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: isDirty ? 1 : 0.6,
          }}
        >
          <Text style={{ color: isDirty ? '#FFFFFF' : '#94A3B8', fontWeight: '600', fontSize: 15 }}>Save</Text>
        </Pressable>
        {isEdit && (
          <Pressable
            onPress={revertChanges}
            disabled={!isDirty}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: isDirty ? 1 : 0.6,
            }}
          >
            <Text style={{ color: '#374151', fontWeight: '500', fontSize: 15 }}>Revert changes</Text>
          </Pressable>
        )}
      </View>

      {/* Category bottom sheet */}
      <PickerSheet
        visible={categorySheet}
        title="Category"
        type="category"
        options={categoryOptions}
        selected={category}
        onSelect={v => { setCategory(v); setCategorySheet(false); }}
        onCreate={value => { const option = addHouseOption('category', value, 'pricetag-outline'); if (option) { setCategory(option.name); setCategorySheet(false); } }}
        onClose={() => setCategorySheet(false)}
      />

      {/* Location bottom sheet */}
      <PickerSheet
        visible={locationSheet}
        title="Location"
        type="location"
        options={locationOptions}
        selected={location}
        onSelect={v => { setLocation(v); setLocationSheet(false); }}
        onCreate={value => { const option = addHouseOption('location', value, 'location-outline'); if (option) { setLocation(option.name); setLocationSheet(false); } }}
        onClose={() => setLocationSheet(false)}
      />

      {/* Zero-qty shopping list sheet */}
      <NativeSheet visible={zeroQtySheet} onClose={handleZeroQtyNotNow}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Item finished!</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Add {pendingZeroQty?.itemName} to your shopping list?</Text>
          <View style={{ marginTop: 24, gap: 12 }}>
            <Pressable onPress={handleZeroQtyAddToList} style={{ backgroundColor: '#0F172A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Add to shopping list</Text>
            </Pressable>
            <Pressable onPress={handleZeroQtyNotNow} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#374151' }}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </NativeSheet>

      {/* Delete confirmation */}
      <Modal visible={deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(false)}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} onPress={() => setDeleteConfirm(false)} />
          <Pressable style={{ backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 32, padding: 24, width: 288 }} onPress={() => {}}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Delete "{existing?.name}"?</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>This will also remove it from your shopping list.</Text>
            <View style={{ gap: 12 }}>
              <Pressable onPress={confirmDelete} style={{ backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>Delete</Text>
              </Pressable>
              <Pressable onPress={() => setDeleteConfirm(false)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#374151' }}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Toast */}
      <Animated.View pointerEvents="none" style={{ opacity: toastOpacity, position: 'absolute', bottom: 112, left: 24, right: 24, alignItems: 'center' }}>
        <View style={{ backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={16} color="#34D399" />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500' }}>{toastMsg}</Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

function PickerSheet({
  visible, title, type, options, selected, onSelect, onCreate, onClose,
}: {
  visible: boolean;
  title: string;
  type: HouseOptionType;
  options: HouseOption[];
  selected: string;
  onSelect: (value: string) => void;
  onCreate: (value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter(option => option.name.toLowerCase().includes(normalizedQuery));
  const exactMatch = options.some(option => option.name.toLowerCase() === normalizedQuery);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  return (
    <NativeSheet visible={visible} onClose={onClose} snapPoints={['50%', '90%']}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>
        <View style={{ marginHorizontal: 16, marginBottom: 8, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${type}s`}
            placeholderTextColor="#94A3B8"
            autoCapitalize="words"
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' }}
          />
        </View>
        <FlatList
          data={filteredOptions}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6', marginLeft: 16, marginRight: 16 }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelect(item.name)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
              <Ionicons name={item.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color="#64748B" style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, fontSize: 14, color: '#111827' }}>{item.name}</Text>
              {selected === item.name && <Ionicons name="checkmark" size={18} color="#141C2D" />}
            </Pressable>
          )}
          ListEmptyComponent={normalizedQuery && exactMatch ? null : <Text style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>No {type}s found</Text>}
        />
        {normalizedQuery && !exactMatch && (
          <Pressable onPress={() => onCreate(query)} style={{ height: 44, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Add “{query.trim()}”</Text>
          </Pressable>
        )}
      </View>
    </NativeSheet>
  );
}
