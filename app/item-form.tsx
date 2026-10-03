import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  Animated,
  View,
  Text,
  TextInput,
  ScrollView,
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
import { Tappable } from '../components/ui/tappable';
import { theme } from '@/constants/theme';

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
      style={{ flex: 1, backgroundColor: theme.colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <Tappable onPress={() => router.dismiss()} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Tappable>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '600', color: theme.colors.text }}>
            {isEdit ? existing!.name : 'Add new item'}
          </Text>
          {isEdit && (
            <Tappable onPress={handleDelete} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={22} color={theme.colors.danger} />
            </Tappable>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Low-stock suggestion */}
        {isEdit && (parseInt(qty, 10) || 0) === 1 && (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: theme.colors.warningBg, borderWidth: 1, borderColor: theme.colors.warningBorder, borderRadius: 16, padding: 16 }}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.warning} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.warningText }}>Running low</Text>
              <Text style={{ fontSize: 12, color: theme.colors.warningText, lineHeight: 20 }}>Only 1 left — consider restocking soon.</Text>
              {isInShoppingList ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: theme.colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark" size={12} color={theme.colors.surface} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.surface }}>Added to shopping list</Text>
                </View>
              ) : (
                <Tappable
                  onPress={() => { addToShoppingList(existing!.name, existing!.id); router.dismiss(); }}
                  style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: theme.colors.warning, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.surface }}>Add to shopping list</Text>
                </Tappable>
              )}
            </View>
          </View>
        )}

        {/* Out-of-stock suggestion */}
        {isEdit && (parseInt(qty, 10) || 0) === 0 && (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: theme.colors.dangerBg, borderWidth: 1, borderColor: theme.colors.dangerBorder, borderRadius: 16, padding: 16 }}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.danger} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.dangerText }}>Out of stock</Text>
              <Text style={{ fontSize: 12, color: theme.colors.dangerText, lineHeight: 20 }}>You've used all of {existing!.name}.</Text>
              {isInShoppingList ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: theme.colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark" size={12} color={theme.colors.surface} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.surface }}>Added to shopping list</Text>
                </View>
              ) : (
                <Tappable
                  onPress={() => { addToShoppingList(existing!.name, existing!.id); router.dismiss(); }}
                  style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: theme.colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.surface }}>Add to shopping list</Text>
                </Tappable>
              )}
            </View>
          </View>
        )}

        {/* Item name */}
        <Field label="Item name">
          <TextInput
            style={{ backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 14, color: theme.colors.text }}
            placeholder='"Atta" or "Rice"'
            placeholderTextColor={theme.colors.textFaint}
            value={name}
            onChangeText={setName}
            autoFocus={!isEdit}
            autoCorrect={false}
          />
        </Field>

        {/* Category */}
        <Field label="Category">
          <Tappable
            onPress={() => setCategorySheet(true)}
            style={{ backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center' }}
          >
            {category && <Ionicons name={(categoryOptions.find(option => option.name === category)?.icon ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name']} size={18} color={theme.colors.textMuted} style={{ marginRight: 10 }} />}
            <Text style={{ flex: 1, fontSize: 14, color: category ? theme.colors.text : theme.colors.textFaint }}>{category || 'Select a category'}</Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textFaint} />
          </Tappable>
        </Field>

        {/* Location */}
        <Field label="Location">
          <Tappable
            onPress={() => setLocationSheet(true)}
            style={{ backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center' }}
          >
            {location && <Ionicons name={(locationOptions.find(option => option.name === location)?.icon ?? 'location-outline') as React.ComponentProps<typeof Ionicons>['name']} size={18} color={theme.colors.textMuted} style={{ marginRight: 10 }} />}
            <Text style={{ flex: 1, fontSize: 14, color: location ? theme.colors.text : theme.colors.textFaint }}>{location || 'Where is it stored?'}</Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textFaint} />
          </Tappable>
        </Field>

        {/* Quantity */}
        <View style={{ backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 20, marginTop: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Quantity</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Tappable
              onPress={() => setQty(String(Math.max(0, (parseInt(qty, 10) || 0) - 1)))}
              disabled={(parseInt(qty, 10) || 0) === 0}
              style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', opacity: (parseInt(qty, 10) || 0) === 0 ? 0.3 : 1 }}
            >
              <Ionicons name="remove" size={22} color={theme.colors.text} />
            </Tappable>
            <Text style={{ fontSize: 32, fontWeight: '700', color: theme.colors.text }}>{parseInt(qty, 10) || 0}</Text>
            <Tappable
              onPress={() => setQty(String((parseInt(qty, 10) || 0) + 1))}
              style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={22} color={theme.colors.surface} />
            </Tappable>
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
            <View style={{ marginTop: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
              <View style={{ backgroundColor: theme.colors.surfaceSunken, paddingHorizontal: 16, justifyContent: 'center', height: 36 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>Recent Activity</Text>
              </View>
              {logs.map((log, i) => {
                const action = log.action ?? 'used';
                const dotColor = action === 'added' ? theme.colors.info : action === 'restocked' ? theme.colors.success : theme.colors.primary;
                const label = action === 'added' ? `Added ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                  action === 'restocked' ? `Restocked ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                    `Used ${log.qty} unit${log.qty !== 1 ? 's' : ''}`;
                return (
                  <View key={log.id} style={{ backgroundColor: theme.colors.surface, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', height: 56, borderBottomWidth: i < logs.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: dotColor }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: theme.colors.primary, fontWeight: '500' }}>{label}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>{formatActivityDate(log.consumed_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </ScrollView>

      {/* Sticky footer — Save (left) + Revert changes (right) */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingBottom: insets.bottom + 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.surfaceSunken, gap: 10 }}>
        <Tappable
          onPress={handleSave}
          disabled={!isDirty}
          style={{
            flex: 1,
            backgroundColor: isDirty ? theme.colors.primary : theme.colors.border,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: isDirty ? 1 : 0.6,
          }}
        >
          <Text style={{ color: isDirty ? theme.colors.surface : theme.colors.textFaint, fontWeight: '600', fontSize: 15 }}>Save</Text>
        </Tappable>
        {isEdit && (
          <Tappable
            onPress={revertChanges}
            disabled={!isDirty}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: isDirty ? 1 : 0.6,
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '500', fontSize: 15 }}>Revert changes</Text>
          </Tappable>
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
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.colors.text }}>Item finished!</Text>
          <Text style={{ fontSize: 14, color: theme.colors.textMuted, marginTop: 4 }}>Add {pendingZeroQty?.itemName} to your shopping list?</Text>
          <View style={{ marginTop: 24, gap: 12 }}>
            <Tappable onPress={handleZeroQtyAddToList} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.surface, fontWeight: '600' }}>Add to shopping list</Text>
            </Tappable>
            <Tappable onPress={handleZeroQtyNotNow} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text }}>Not now</Text>
            </Tappable>
          </View>
        </View>
      </NativeSheet>

      {/* Delete confirmation */}
      <Modal visible={deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(false)}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Tappable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} onPress={() => setDeleteConfirm(false)} />
          <Tappable style={{ backgroundColor: theme.colors.surface, borderRadius: 16, marginHorizontal: 32, padding: 24, width: 288 }} onPress={() => {}}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 8 }}>Delete "{existing?.name}"?</Text>
            <Text style={{ fontSize: 14, color: theme.colors.textMuted, marginBottom: 24 }}>This will also remove it from your shopping list.</Text>
            <View style={{ gap: 12 }}>
              <Tappable onPress={confirmDelete} style={{ backgroundColor: theme.colors.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.surface, fontWeight: '500' }}>Delete</Text>
              </Tappable>
              <Tappable onPress={() => setDeleteConfirm(false)} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.text }}>Cancel</Text>
              </Tappable>
            </View>
          </Tappable>
        </View>
      </Modal>

      {/* Toast */}
      <Animated.View pointerEvents="none" style={{ opacity: toastOpacity, position: 'absolute', bottom: 112, left: 24, right: 24, alignItems: 'center' }}>
        <View style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.successBright} />
          <Text style={{ color: theme.colors.surface, fontSize: 14, fontWeight: '500' }}>{toastMsg}</Text>
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
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 }}>{label}</Text>
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
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>{title}</Text>
          <Tappable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color={theme.colors.textMuted} />
          </Tappable>
        </View>
        <View style={{ marginHorizontal: 16, marginBottom: 8, height: 44, borderRadius: 12, backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${type}s`}
            placeholderTextColor={theme.colors.textFaint}
            autoCapitalize="words"
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: theme.colors.text }}
          />
        </View>
        <FlatList
          data={filteredOptions}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.surfaceSunken, marginLeft: 16, marginRight: 16 }} />}
          renderItem={({ item }) => (
            <Tappable onPress={() => onSelect(item.name)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
              <Ionicons name={item.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color={theme.colors.textMuted} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, fontSize: 14, color: theme.colors.text }}>{item.name}</Text>
              {selected === item.name && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
            </Tappable>
          )}
          ListEmptyComponent={normalizedQuery && exactMatch ? null : <Text style={{ padding: 24, textAlign: 'center', color: theme.colors.textFaint }}>No {type}s found</Text>}
        />
        {normalizedQuery && !exactMatch && (
          <Tappable onPress={() => onCreate(query)} style={{ height: 44, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="add-circle-outline" size={18} color={theme.colors.surface} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.surface }}>Add “{query.trim()}”</Text>
          </Tappable>
        )}
      </View>
    </NativeSheet>
  );
}
