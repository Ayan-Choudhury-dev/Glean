import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, TextInput, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeSheet } from '../../components/NativeSheet';
import { useGleanStore, ShoppingItem } from '../../store/useGleanStore';

const RowSeparator = () => <View style={{ height: 1, backgroundColor: '#E5E7EB', marginLeft: 24, marginRight: 24 }} />;

const ShoppingRow = React.memo(function ShoppingRow({
  item,
  onToggle,
  onAdjust,
}: {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
}) {
  const purchased = item.status === 'purchased';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 12 }}>
      <Pressable
        onPress={() => onToggle(item.id)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: purchased }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: purchased ? '#10B981' : '#D1D5DB', backgroundColor: purchased ? '#10B981' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {purchased && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: purchased ? '#94A3B8' : '#111827', textDecorationLine: purchased ? 'line-through' : 'none' }}>{item.name}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={() => onAdjust(item.id, -1)}
          disabled={item.target_qty <= 1}
          style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', opacity: item.target_qty <= 1 ? 0.3 : 1 }}
        >
          <Ionicons name="remove" size={14} color="#374151" />
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', minWidth: 20, textAlign: 'center' }}>{item.target_qty}</Text>
        <Pressable
          onPress={() => onAdjust(item.id, 1)}
          style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={14} color="#374151" />
        </Pressable>
      </View>
    </View>
  );
});

export default function ShoppingScreen() {
  const { inventory, shoppingList, addToShoppingList, adjustShoppingQty, updatePantry, undoLastPantryUpdate } =
    useGleanStore();
  const [addItemSheet, setAddItemSheet] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ message: string; canUndo?: boolean } | null>(null);

  const toBuy = shoppingList.filter(i => i.status === 'to_buy');
  const purchased = shoppingList.filter(i => i.status === 'purchased');

  const queuedIds = new Set(shoppingList.map(s => s.inventory_id).filter(Boolean));
  const queuedNames = new Set(shoppingList.map(s => s.name.toLowerCase()));
  const addItemResults = useMemo(() => {
    const q = addItemSearch.trim().toLowerCase();
    return inventory.filter(item => !q || item.name.toLowerCase().includes(q));
  }, [inventory, addItemSearch]);

  useEffect(() => {
    if (!snackbar) return;
    const timeout = setTimeout(() => setSnackbar(null), 4500);
    return () => clearTimeout(timeout);
  }, [snackbar]);

  const insets = useSafeAreaInsets();

  const togglePurchased = useCallback((id: string) => {
    const { shoppingList, markAsPurchased, unmarkPurchased } = useGleanStore.getState();
    const item = shoppingList.find(i => i.id === id);
    if (!item) return;
    if (item.status === 'purchased') {
      unmarkPurchased(id);
    } else {
      markAsPurchased(id);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ height: 64 + insets.top, paddingTop: insets.top }}>
        <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#0F172A' }}>Shopping list</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>{toBuy.length} item{toBuy.length !== 1 ? 's' : ''} to buy</Text>
        <Pressable
          onPress={() => { setAddItemSearch(''); setAddItemSheet(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add item</Text>
        </Pressable>
      </View>

      {shoppingList.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Ionicons name="basket-outline" size={48} color="#CBD5E1" />
          <Text style={{ fontSize: 14, color: '#94A3B8', marginTop: 12 }}>Nothing to buy yet.</Text>
          <Text style={{ fontSize: 13, color: '#CBD5E1', marginTop: 4 }}>Search your inventory to add an item.</Text>
        </View>
      ) : (
          <SectionList
            style={{ flex: 1 }}
            sections={[{ key: 'shopping', title: '', data: shoppingList }]}
            keyExtractor={item => item.id}
            stickySectionHeadersEnabled={false}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
            renderSectionHeader={() => null}
            renderItem={({ item: s }) => (
              <ShoppingRow item={s} onToggle={togglePurchased} onAdjust={adjustShoppingQty} />
            )}
            ItemSeparatorComponent={RowSeparator}
          />
       )}

       <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 88 }}>
        <Pressable
          onPress={() => {
            const count = purchased.length;
            updatePantry();
            setSnackbar({ message: `${count} item${count !== 1 ? 's' : ''} added to pantry`, canUndo: true });
          }}
          disabled={purchased.length === 0}
          style={{ backgroundColor: purchased.length > 0 ? '#0F172A' : '#E2E8F0', borderRadius: 12, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 }}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={purchased.length > 0 ? '#FFFFFF' : '#94A3B8'} />
          <Text style={{ color: purchased.length > 0 ? '#FFFFFF' : '#94A3B8', fontWeight: '600', fontSize: 16 }}>
            Update all items{purchased.length > 0 ? ` (${purchased.length})` : ''}
          </Text>
        </Pressable>
      </View>

      {snackbar && (
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 148, minHeight: 52, borderRadius: 14, backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12 }}>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 13 }} numberOfLines={1}>{snackbar.message}</Text>
          {snackbar.canUndo && (
            <Pressable
              onPress={() => { undoLastPantryUpdate(); setSnackbar(null); }}
              hitSlop={8}
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text style={{ color: '#93C5FD', fontSize: 13, fontWeight: '700' }}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Add item sheet */}
      <NativeSheet visible={addItemSheet} onClose={() => setAddItemSheet(false)} snapPoints={['90%']}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' }}>Add item</Text>
            <Pressable onPress={() => setAddItemSheet(false)} hitSlop={12}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, height: 44, paddingHorizontal: 12 }}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#1F2937' }}
                placeholder="Search inventory…"
                placeholderTextColor="#9CA3AF"
                value={addItemSearch}
                onChangeText={setAddItemSearch}
                autoFocus
              />
            </View>
          </View>

          <FlatList
            data={addItemResults}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6', marginLeft: 16, marginRight: 16 }} />}
            ListEmptyComponent={
              addItemSearch.trim().length > 0 ? (
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
                  onPress={() => {
                    addToShoppingList(addItemSearch.trim());
                    setAddItemSheet(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>Add "{addItemSearch.trim()}"</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Not in your inventory</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color="#141C2D" />
                </Pressable>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No items found</Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const alreadyQueued = queuedIds.has(item.id) || queuedNames.has(item.name.toLowerCase());
              return (
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, opacity: alreadyQueued ? 0.4 : 1 }}
                  onPress={() => {
                    if (!alreadyQueued) {
                      addToShoppingList(item.name, item.id);
                      setAddItemSheet(false);
                    }
                  }}
                  disabled={alreadyQueued}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: alreadyQueued ? '#D1D5DB' : '#111827' }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{item.category}</Text>
                  </View>
                  {alreadyQueued ? (
                    <Text style={{ fontSize: 12, color: '#D1D5DB' }}>Added</Text>
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color="#141C2D" />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </NativeSheet>
    </View>
  );
}
