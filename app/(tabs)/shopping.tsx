import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tappable } from '../../components/ui/tappable';
import { NativeSheet } from '../../components/NativeSheet';
import { useGleanStore, ShoppingItem } from '../../store/useGleanStore';
import { getRestockSuggestions, type RestockSuggestion } from '../../lib/predictions';

const C = {
  primary: '#0F172A',
  text: '#111827',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E5E7EB',
  chipBg: '#F1F5F9',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  green: '#10B981',
} as const;

type Tab = 'to_buy' | 'purchased';

const RowSeparator = () => <View style={{ height: 1, backgroundColor: C.border, marginLeft: 24, marginRight: 24 }} />;

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
      <Tappable
        onPress={() => onToggle(item.id)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: purchased }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: purchased ? C.green : '#D1D5DB', backgroundColor: purchased ? C.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {purchased && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </Tappable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: purchased ? C.faint : C.text, textDecorationLine: purchased ? 'line-through' : 'none' }}>{item.name}</Text>
        {purchased && <Text style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Qty: {item.target_qty}</Text>}
      </View>
      {!purchased && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tappable
            onPress={() => onAdjust(item.id, -1)}
            disabled={item.target_qty <= 1}
            style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', opacity: item.target_qty <= 1 ? 0.3 : 1 }}
          >
            <Ionicons name="remove" size={14} color="#374151" />
          </Tappable>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, minWidth: 20, textAlign: 'center' }}>{item.target_qty}</Text>
          <Tappable
            onPress={() => onAdjust(item.id, 1)}
            style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={14} color="#374151" />
          </Tappable>
        </View>
      )}
    </View>
  );
});

const SuggestionRow = React.memo(function SuggestionRow({
  suggestion,
  onAdd,
}: {
  suggestion: RestockSuggestion;
  onAdd: (s: RestockSuggestion) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: C.amberBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="bulb-outline" size={16} color={C.amber} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: C.text }}>{suggestion.name}</Text>
        <Text style={{ fontSize: 12, color: C.amber, marginTop: 2 }}>Predicted to finish {suggestion.label}</Text>
      </View>
      <Tappable
        onPress={() => onAdd(suggestion)}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Ionicons name="add" size={14} color={C.primary} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: C.primary }}>Add</Text>
      </Tappable>
    </View>
  );
});

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</Text>
    </View>
  );
}

export default function ShoppingScreen() {
  const { inventory, shoppingList, consumptionLogs, addToShoppingList, adjustShoppingQty, updatePantry, undoLastPantryUpdate } =
    useGleanStore();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('to_buy');
  const [addItemSheet, setAddItemSheet] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ message: string; canUndo?: boolean } | null>(null);

  const toBuy = shoppingList.filter(i => i.status === 'to_buy');
  const purchased = shoppingList.filter(i => i.status === 'purchased');

  const suggestions = useMemo(
    () => getRestockSuggestions(inventory, consumptionLogs, shoppingList),
    [inventory, consumptionLogs, shoppingList],
  );

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

  const togglePurchased = useCallback((id: string) => {
    const { shoppingList: list, markAsPurchased, unmarkPurchased } = useGleanStore.getState();
    const item = list.find(i => i.id === id);
    if (!item) return;
    if (item.status === 'purchased') {
      unmarkPurchased(id);
    } else {
      markAsPurchased(id);
    }
  }, []);

  const handleAddSuggestion = useCallback((s: RestockSuggestion) => {
    addToShoppingList(s.name, s.itemId);
  }, [addToShoppingList]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'to_buy', label: 'To Buy', count: toBuy.length },
    { key: 'purchased', label: 'Purchased', count: purchased.length },
  ];

  const emptyToBuy = toBuy.length === 0 && suggestions.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ height: 64 + insets.top, paddingTop: insets.top }}>
        <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: C.primary }}>Shopping list</Text>
          <Tappable
            onPress={() => { setAddItemSearch(''); setAddItemSheet(true); }}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add item</Text>
          </Tappable>
        </View>
      </View>

      {/* Segmented control */}
      <View style={{ flexDirection: 'row', backgroundColor: C.chipBg, borderRadius: 12, padding: 4, marginHorizontal: 24, marginTop: 8 }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <Tappable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: active ? '#FFFFFF' : 'transparent' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: active ? C.primary : C.faint }}>{t.label}</Text>
              <View style={{ minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: active ? C.primary : '#E2E8F0' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', textAlign: 'center', color: active ? '#FFFFFF' : C.muted }}>{t.count}</Text>
              </View>
            </Tappable>
          );
        })}
      </View>

      {tab === 'to_buy' ? (
        emptyToBuy ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
            <Ionicons name="basket-outline" size={48} color="#CBD5E1" />
            <Text style={{ fontSize: 14, color: C.faint, marginTop: 12 }}>Nothing to buy yet.</Text>
            <Text style={{ fontSize: 13, color: '#CBD5E1', marginTop: 4 }}>Search your inventory to add an item.</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {suggestions.length > 0 && (
              <>
                <SectionLabel label="Suggested" />
                {suggestions.map((s, i) => (
                  <View key={s.itemId}>
                    <SuggestionRow suggestion={s} onAdd={handleAddSuggestion} />
                    {i < suggestions.length - 1 && <RowSeparator />}
                  </View>
                ))}
              </>
            )}
            {toBuy.length > 0 && (
              <>
                <SectionLabel label="To buy" />
                {toBuy.map((s, i) => (
                  <View key={s.id}>
                    <ShoppingRow item={s} onToggle={togglePurchased} onAdjust={adjustShoppingQty} />
                    {i < toBuy.length - 1 && <RowSeparator />}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )
      ) : purchased.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
          <Text style={{ fontSize: 14, color: C.faint, marginTop: 12 }}>No purchased items.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}>
          {purchased.map((s, i) => (
            <View key={s.id}>
              <ShoppingRow item={s} onToggle={togglePurchased} onAdjust={adjustShoppingQty} />
              {i < purchased.length - 1 && <RowSeparator />}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Update pantry CTA — only when there is something to commit */}
      {tab === 'purchased' && purchased.length > 0 && (
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 88 }}>
          <Tappable
            onPress={() => {
              const count = purchased.length;
              updatePantry();
              setSnackbar({ message: `${count} item${count !== 1 ? 's' : ''} added to pantry`, canUndo: true });
            }}
            style={{ backgroundColor: C.primary, borderRadius: 12, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
              Update Pantry ({purchased.length})
            </Text>
          </Tappable>
        </View>
      )}

      {snackbar && (
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 148, minHeight: 52, borderRadius: 14, backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12 }}>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 13 }} numberOfLines={1}>{snackbar.message}</Text>
          {snackbar.canUndo && (
            <Tappable
              onPress={() => { undoLastPantryUpdate(); setSnackbar(null); }}
              hitSlop={8}
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text style={{ color: '#93C5FD', fontSize: 13, fontWeight: '700' }}>Undo</Text>
            </Tappable>
          )}
        </View>
      )}

      {/* Add item sheet */}
      <NativeSheet visible={addItemSheet} onClose={() => setAddItemSheet(false)} snapPoints={['90%']}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: C.text }}>Add item</Text>
            <Tappable onPress={() => setAddItemSheet(false)} hitSlop={12}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </Tappable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: C.border, borderRadius: 12, height: 44, paddingHorizontal: 12 }}>
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
                <Tappable
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
                  onPress={() => {
                    addToShoppingList(addItemSearch.trim());
                    setAddItemSheet(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: C.text }}>Add "{addItemSearch.trim()}"</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Not in your inventory</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color="#141C2D" />
                </Tappable>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No items found</Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const alreadyQueued = queuedIds.has(item.id) || queuedNames.has(item.name.toLowerCase());
              return (
                <Tappable
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
                    <Text style={{ fontSize: 14, fontWeight: '500', color: alreadyQueued ? '#D1D5DB' : C.text }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{item.category}</Text>
                  </View>
                  {alreadyQueued ? (
                    <Text style={{ fontSize: 12, color: '#D1D5DB' }}>Added</Text>
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color="#141C2D" />
                  )}
                </Tappable>
              );
            }}
          />
        </View>
      </NativeSheet>
    </View>
  );
}
