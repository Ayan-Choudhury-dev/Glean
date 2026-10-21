import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Animated,
  View,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeSheet } from '../components/NativeSheet';
import { PickerSheet } from '../components/PickerSheet';
import { DEFAULT_HOUSE_OPTIONS, HouseOption, HouseOptionType, useGleanStore } from '../store/useGleanStore';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { AnimatedNumber } from '../components/animated-number';
import { theme } from '@/constants/theme';
import { uploadItemImage } from '../lib/upload';
import { useColors } from '@/lib/appearance';
import { categoryImage } from '@/constants/categoryImages';
import { RECENT_ACTIVITY_DISPLAY_LIMIT } from '@/constants/config';
import { showDialog } from '@/lib/overlay';

export default function ItemFormScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { inventory, consumptionLogs, addInventoryItem, editInventoryItem, deleteInventoryItem,
          addToShoppingList, logConsumption, houseOptions, addHouseOption, shoppingList, house } = useGleanStore();

  const existing = itemId ? inventory.find(i => i.id === itemId) : null;
  const isEdit = !!existing;

  // Name of the member who made a given activity entry (null on legacy rows).
  const memberName = (userId?: string | null) =>
    userId ? house?.members.find(m => m.id === userId)?.name ?? null : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [qty, setQty] = useState(String(existing?.qty ?? ''));
  const [category, setCategory] = useState(existing?.category ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [imageUri, setImageUri] = useState<string | null>(existing?.image_url ?? null);
  const [imageDirty, setImageDirty] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const isDirty = imageDirty || (isEdit
    ? name.trim() !== (existing?.name ?? '') ||
      (parseInt(qty, 10) || 0) !== (existing?.qty ?? 0) ||
      category !== (existing?.category ?? '') ||
      location !== (existing?.location ?? '')
    : name.trim().length > 0);

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
  const [photoOpen, setPhotoOpen] = useState(false);
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
  const categoryArt = categoryImage(category);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showDialog({ title: 'Permission needed', message: 'Allow photo access to add an item photo.', cancelLabel: null });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageDirty(true);
    }
  };

  // Upload a freshly-picked photo and persist its public URL. On failure we keep
  // the existing value (or none) — a device-local file:// URI must never be stored,
  // it can't load on another device or after a cache clear.
  const commitImage = (id: string) => {
    if (!imageDirty || !imageUri || imageUri.startsWith('http')) return;
    if (!house?.id) {
      console.warn('[upload] no house loaded; skipping image upload');
      return;
    }
    uploadItemImage(imageUri, house.id, id).then(url => {
      if (url) editInventoryItem(id, { image_url: url });
      else console.warn('[upload] item image not saved for', id);
    });
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Enter an item name.');
      return;
    }
    setNameError(null);

    const duplicate = inventory.find(
      i => i.name.toLowerCase() === trimmedName.toLowerCase() && i.id !== existing?.id
    );
    if (duplicate) {
      setNameError(`"${trimmedName}" is already in your inventory.`);
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
      commitImage(existing.id);

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
      commitImage(newId);
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
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <Tappable onPress={() => router.dismiss()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Tappable>
          <Text style={{ flex: 1, fontSize: theme.type.xl, color: colors.text, fontFamily: theme.fonts.display }}>
            {isEdit ? existing!.name : 'Add new item'}
          </Text>
          {isEdit && (
            <Tappable onPress={handleDelete} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete item" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Tappable>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Photo — tap to expand and change */}
        <Tappable
          onPress={() => setPhotoOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Item photo — tap to view or change"
          style={{ marginTop: 8, marginBottom: 20 }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              resizeMode="cover"
              style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.lg, backgroundColor: colors.surfaceSunken }}
            />
          ) : categoryArt ? (
            <View style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.lg, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={categoryArt} resizeMode="contain" style={{ width: '68%', height: '68%' }} />
            </View>
          ) : (
            <View style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="image-outline" size={28} color={colors.textMuted} />
              <Text style={{ fontSize: theme.type.sm, color: colors.textMuted }}>Add photo</Text>
            </View>
          )}
        </Tappable>

        {/* Low-stock suggestion */}
        {isEdit && (parseInt(qty, 10) || 0) === 1 && (
          <View style={{ marginTop: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: theme.radii.lg, padding: 16 }}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.warning} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: colors.warningText }}>Running low</Text>
              <Text style={{ fontSize: theme.type.caption, color: colors.warningText, lineHeight: 20 }}>Only 1 left — consider restocking soon.</Text>
              {isInShoppingList ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.success, borderRadius: theme.radii.sm, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark" size={12} color={colors.surface} />
                  <Text style={{ fontSize: theme.type.caption, fontWeight: '600', color: colors.surface }}>Added to shopping list</Text>
                </View>
              ) : (
                <Tappable
                  onPress={() => { addToShoppingList(existing!.name, existing!.id); router.dismiss(); }}
                  style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.warning, borderRadius: theme.radii.sm, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: theme.type.caption, fontWeight: '600', color: colors.surface }}>Add to shopping list</Text>
                </Tappable>
              )}
            </View>
          </View>
        )}

        {/* Out-of-stock suggestion */}
        {isEdit && (parseInt(qty, 10) || 0) === 0 && (
          <View style={{ marginTop: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: theme.radii.lg, padding: 16 }}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: colors.dangerText }}>Out of stock</Text>
              <Text style={{ fontSize: theme.type.caption, color: colors.dangerText, lineHeight: 20 }}>You've used all of {existing!.name}.</Text>
              {isInShoppingList ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.success, borderRadius: theme.radii.sm, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark" size={12} color={colors.surface} />
                  <Text style={{ fontSize: theme.type.caption, fontWeight: '600', color: colors.surface }}>Added to shopping list</Text>
                </View>
              ) : (
                <Tappable
                  onPress={() => { addToShoppingList(existing!.name, existing!.id); router.dismiss(); }}
                  style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.danger, borderRadius: theme.radii.sm, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: theme.type.caption, fontWeight: '600', color: colors.surface }}>Add to shopping list</Text>
                </Tappable>
              )}
            </View>
          </View>
        )}

        {/* Item name */}
        <Field label="Item name">
          <TextInput
            style={{ backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: nameError ? colors.danger : colors.border, borderRadius: theme.radii.md, paddingHorizontal: 16, height: 48, fontSize: theme.type.label, color: colors.text, fontFamily: theme.fonts.regular }}
            placeholder='"Atta" or "Rice"'
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={v => { setName(v); setNameError(null); }}
            autoFocus={!isEdit}
            autoCorrect={false}
            accessibilityLabel="Item name"
          />
          {nameError ? (
            <Text style={{ color: colors.danger, fontSize: theme.type.sm, marginTop: 6 }}>{nameError}</Text>
          ) : null}
        </Field>

        {/* Quantity */}
        <View style={{ backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.lg, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: theme.type.caption, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Quantity</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Tappable
              onPress={() => setQty(String(Math.max(0, (parseInt(qty, 10) || 0) - 1)))}
              disabled={(parseInt(qty, 10) || 0) === 0}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              style={{ width: 56, height: 56, borderRadius: theme.radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: (parseInt(qty, 10) || 0) === 0 ? 0.5 : 1 }}
            >
              <Ionicons name="remove" size={22} color={colors.text} />
            </Tappable>
            <AnimatedNumber value={parseInt(qty, 10) || 0} style={{ fontSize: theme.type.display, color: colors.text, fontFamily: theme.fonts.monoMedium }} />
            <Tappable
              onPress={() => setQty(String((parseInt(qty, 10) || 0) + 1))}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              style={{ width: 56, height: 56, borderRadius: theme.radii.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={22} color={colors.surface} />
            </Tappable>
          </View>
        </View>

        {/* Category */}
        <Field label="Category">
          <Tappable
            onPress={() => setCategorySheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Select category"
            style={{ backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.md, paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center' }}
          >
            {category && <Ionicons name={(categoryOptions.find(option => option.name === category)?.icon ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name']} size={18} color={colors.textMuted} style={{ marginRight: 10 }} />}
            <Text style={{ flex: 1, fontSize: theme.type.label, color: category ? colors.text : colors.textFaint }}>{category || 'Select a category'}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textFaint} />
          </Tappable>
        </Field>

        {/* Location */}
        <Field label="Location">
          <Tappable
            onPress={() => setLocationSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Select location"
            style={{ backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.md, paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center' }}
          >
            {location && <Ionicons name={(locationOptions.find(option => option.name === location)?.icon ?? 'location-outline') as React.ComponentProps<typeof Ionicons>['name']} size={18} color={colors.textMuted} style={{ marginRight: 10 }} />}
            <Text style={{ flex: 1, fontSize: theme.type.label, color: location ? colors.text : colors.textFaint }}>{location || 'Where is it stored?'}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textFaint} />
          </Tappable>
        </Field>

        {/* Recent Activity */}
        {isEdit && (() => {
          const logs = consumptionLogs
            .filter(l => l.inventory_id === existing!.id)
            .sort((a, b) => new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime())
            .slice(0, RECENT_ACTIVITY_DISPLAY_LIMIT);
          if (logs.length === 0) return null;
          return (
            <View style={{ marginTop: 8, borderRadius: theme.radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ backgroundColor: colors.surfaceSunken, paddingHorizontal: 16, justifyContent: 'center', height: 36 }}>
                <Text style={{ fontSize: theme.type.caption, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>Recent Activity</Text>
              </View>
              {logs.map((log, i) => {
                const action = log.action ?? 'used';
                const dotColor = action === 'added' ? colors.info : action === 'restocked' ? colors.success : colors.primary;
                const label = action === 'added' ? `Added ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                  action === 'restocked' ? `Restocked ${log.qty} unit${log.qty !== 1 ? 's' : ''}` :
                    `Used ${log.qty} unit${log.qty !== 1 ? 's' : ''}`;
                return (
                  <View key={log.id} style={{ backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', height: 56, borderBottomWidth: i < logs.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <View style={{ width: 8, height: 8, borderRadius: theme.radii.pill, backgroundColor: dotColor }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: theme.type.label, color: colors.primary, fontWeight: '500' }}>{label}</Text>
                      <Text style={{ fontSize: theme.type.caption, color: colors.textMuted }} numberOfLines={1}>
                        {[memberName(log.user_id), formatActivityDate(log.consumed_at)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <View style={{ backgroundColor: colors.surfaceSunken, paddingHorizontal: 16, justifyContent: 'center', height: 32 }}>
                <Text style={{ fontSize: theme.type.caption, color: colors.textMuted }}>
                  Showing the last {logs.length} action{logs.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          );
        })()}
      </ScrollView>

      {/* Sticky footer — Save (left) + Revert changes (right) */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingBottom: insets.bottom + 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.surfaceSunken, gap: 10 }}>
        <Tappable
          onPress={handleSave}
          disabled={!isDirty}
          haptic
          style={{
            flex: 1,
            backgroundColor: isDirty ? colors.accent : colors.border,
            borderRadius: theme.radii.md,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: isDirty ? 1 : 0.5,
          }}
        >
          <Text style={{ color: isDirty ? colors.surface : colors.textFaint, fontWeight: '600', fontSize: theme.type.md }}>Save</Text>
        </Tappable>
        {isEdit && (
          <Tappable
            onPress={revertChanges}
            disabled={!isDirty}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: theme.radii.md,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: isDirty ? 1 : 0.5,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '500', fontSize: theme.type.md }}>Revert changes</Text>
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

      {/* Photo expanded view */}
      <NativeSheet visible={photoOpen} onClose={() => setPhotoOpen(false)}>
        <View style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24, alignItems: 'center' }}>
          <View style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.lg, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            ) : categoryArt ? (
              <Image source={categoryArt} resizeMode="contain" style={{ width: '68%', height: '68%' }} />
            ) : (
              <Ionicons name="image-outline" size={40} color={colors.textMuted} />
            )}
          </View>
          <Tappable
            onPress={() => { setPhotoOpen(false); void pickImage(); }}
            accessibilityRole="button"
            accessibilityLabel={imageUri ? 'Change photo' : 'Add custom photo'}
            style={{ marginTop: 20, backgroundColor: colors.accent, borderRadius: theme.radii.md, minHeight: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
          >
            <Ionicons name="camera-outline" size={18} color={colors.onAccent} />
            <Text style={{ color: colors.onAccent, fontSize: theme.type.md, fontFamily: theme.fonts.medium }}>{imageUri ? 'Change photo' : 'Add custom photo'}</Text>
          </Tappable>
          {imageUri && (
            <Tappable
              onPress={() => { setImageUri(null); setImageDirty(true); setPhotoOpen(false); }}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: theme.type.label, fontFamily: theme.fonts.medium }}>Remove photo</Text>
            </Tappable>
          )}
        </View>
      </NativeSheet>

      {/* Zero-qty shopping list sheet */}
      <NativeSheet visible={zeroQtySheet} onClose={handleZeroQtyNotNow}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
          <Text style={{ fontSize: theme.type.title, fontWeight: '600', color: colors.text }}>Item finished!</Text>
          <Text style={{ fontSize: theme.type.label, color: colors.textMuted, marginTop: 4 }}>Add {pendingZeroQty?.itemName} to your shopping list?</Text>
          <View style={{ marginTop: 24, gap: 12 }}>
            <Tappable onPress={handleZeroQtyAddToList} style={{ backgroundColor: colors.accent, borderRadius: theme.radii.md, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.surface, fontWeight: '600' }}>Add to shopping list</Text>
            </Tappable>
            <Tappable onPress={handleZeroQtyNotNow} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.md, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.text }}>Not now</Text>
            </Tappable>
          </View>
        </View>
      </NativeSheet>

      {/* Delete confirmation */}
      <Modal visible={deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(false)}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Tappable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} onPress={() => setDeleteConfirm(false)} />
          <Tappable style={{ backgroundColor: colors.surface, borderRadius: theme.radii.lg, marginHorizontal: 32, padding: 24, width: 288 }} onPress={() => {}}>
            <Text style={{ fontSize: theme.type.body, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Delete "{existing?.name}"?</Text>
            <Text style={{ fontSize: theme.type.label, color: colors.textMuted, marginBottom: 24 }}>This will also remove it from your shopping list.</Text>
            <View style={{ gap: 12 }}>
              <Tappable onPress={confirmDelete} style={{ backgroundColor: colors.danger, borderRadius: theme.radii.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.surface, fontWeight: '500' }}>Delete</Text>
              </Tappable>
              <Tappable onPress={() => setDeleteConfirm(false)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: theme.radii.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </Tappable>
            </View>
          </Tappable>
        </View>
      </Modal>

      {/* Toast */}
      <Animated.View pointerEvents="none" style={{ opacity: toastOpacity, position: 'absolute', bottom: 112, left: 24, right: 24, alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.primary, borderRadius: theme.radii.md, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.successBright} />
          <Text style={{ color: colors.surface, fontSize: theme.type.label, fontWeight: '500' }}>{toastMsg}</Text>
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
  const colors = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: colors.text, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}
