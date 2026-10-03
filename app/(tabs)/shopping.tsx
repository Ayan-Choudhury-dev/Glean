import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TextInput, FlatList, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tappable } from '../../components/ui/tappable';
import { Text } from '../../components/ui/text';
import { CollapsibleHeaderBar, LargeTitle, useCollapsibleHeader, useHeaderContentInset } from '../../components/CollapsibleHeader';
import { NativeSheet } from '../../components/NativeSheet';
import { useGleanStore, ShoppingItem } from '../../store/useGleanStore';
import { getRestockSuggestions, type RestockSuggestion } from '../../lib/predictions';
import { theme } from '@/constants/theme';
import { FEATURES } from '@/constants/config';

const C = {
  text: theme.colors.text,
  muted: theme.colors.textMuted,
  faint: theme.colors.textFaint,
  border: theme.colors.border,
  chipBg: theme.colors.chipBg,
  accent: theme.colors.accent,
  accentSoft: theme.colors.accentSoft,
  onAccent: theme.colors.onAccent,
  warning: theme.colors.warning,
  warningBg: theme.colors.warningBg,
  danger: theme.colors.danger,
} as const;

const PAD = 24;
type Tab = 'to_buy' | 'purchased';

const RowSeparator = () => <View style={{ height: 1, backgroundColor: C.border, marginLeft: PAD + 38, marginRight: PAD }} />;

const ShoppingRow = React.memo(function ShoppingRow({
  item,
  subtitle,
  onToggle,
  onAdjust,
  onRemove,
}: {
  item: ShoppingItem;
  subtitle?: string;
  onToggle: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (item: ShoppingItem) => void;
}) {
  const purchased = item.status === 'purchased';
  return (
    <Tappable
      onLongPress={() => onRemove(item)}
      delayLongPress={350}
      accessibilityLabel={`${item.name}, quantity ${item.target_qty}`}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingVertical: 16, gap: 12 }}
    >
      <Tappable
        onPress={() => onToggle(item.id)}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: purchased }}
        accessibilityLabel={purchased ? `Mark ${item.name} as not purchased` : `Mark ${item.name} as purchased`}
      >
        <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: purchased ? C.accent : theme.colors.borderStrong, backgroundColor: purchased ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {purchased && <Ionicons name="checkmark" size={15} color={C.onAccent} />}
        </View>
      </Tappable>

      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: theme.type.body, fontWeight: '600', color: purchased ? C.faint : C.text, textDecorationLine: purchased ? 'line-through' : 'none' }} numberOfLines={1}>{item.name}</Text>
        {purchased ? (
          <Text style={{ fontSize: 14, color: C.faint }}>Quantity {item.target_qty}</Text>
        ) : subtitle ? (
          <Text style={{ fontSize: 14, color: C.muted }} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {!purchased && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tappable
            onPress={() => onAdjust(item.id, -1)}
            disabled={item.target_qty <= 1}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${item.name}`}
            hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: theme.radii.pill, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center', opacity: item.target_qty <= 1 ? 0.5 : 1 }}
          >
            <Ionicons name="remove" size={15} color={C.text} />
          </Tappable>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, fontFamily: theme.fonts.monoMedium, minWidth: 22, textAlign: 'center' }}>{item.target_qty}</Text>
          <Tappable
            onPress={() => onAdjust(item.id, 1)}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${item.name}`}
            hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: theme.radii.pill, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={15} color={C.accent} />
          </Tappable>
        </View>
      )}
    </Tappable>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingVertical: 14, gap: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: theme.radii.pill, backgroundColor: C.warningBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="bulb-outline" size={16} color={C.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: C.text }}>{suggestion.name}</Text>
        <Text style={{ fontSize: 12, color: C.warning, marginTop: 2 }}>Predicted to finish {suggestion.label}</Text>
      </View>
      <Tappable
        onPress={() => onAdd(suggestion)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Add ${suggestion.name} to list`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: theme.radii.pill, paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Ionicons name="add" size={14} color={C.accent} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: C.accent }}>Add</Text>
      </Tappable>
    </View>
  );
});

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: PAD, paddingTop: 16, paddingBottom: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</Text>
    </View>
  );
}

export default function ShoppingScreen() {
  const {
    inventory, shoppingList, consumptionLogs, house,
    addToShoppingList, adjustShoppingQty, updatePantry, undoLastPantryUpdate,
    removeFromShoppingList, clearPurchased, loadHouseData,
  } = useGleanStore();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useCollapsibleHeader();
  const headerInset = useHeaderContentInset();
  const [tab, setTab] = useState<Tab>('to_buy');
  const [addItemSheet, setAddItemSheet] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; canUndo?: boolean } | null>(null);

  const toBuy = shoppingList.filter(i => i.status === 'to_buy');
  const purchased = shoppingList.filter(i => i.status === 'purchased');

  const suggestions = useMemo(
    () => (FEATURES.restockSuggestions ? getRestockSuggestions(inventory, consumptionLogs, shoppingList) : []),
    [inventory, consumptionLogs, shoppingList],
  );

  const queuedIds = new Set(shoppingList.map(s => s.inventory_id).filter(Boolean));
  const queuedNames = new Set(shoppingList.map(s => s.name.toLowerCase()));
  const addItemResults = useMemo(() => {
    const q = addItemSearch.trim().toLowerCase();
    return inventory.filter(item => !q || item.name.toLowerCase().includes(q));
  }, [inventory, addItemSearch]);

  const categoryById = useMemo(
    () => Object.fromEntries(inventory.map(i => [i.id, i.category])) as Record<string, string>,
    [inventory],
  );

  useEffect(() => {
    if (!snackbar) return;
    const timeout = setTimeout(() => setSnackbar(null), 4500);
    return () => clearTimeout(timeout);
  }, [snackbar]);

  const togglePurchased = useCallback((id: string) => {
    const { shoppingList: list, markAsPurchased, unmarkPurchased } = useGleanStore.getState();
    const item = list.find(i => i.id === id);
    if (!item) return;
    if (item.status === 'purchased') unmarkPurchased(id);
    else markAsPurchased(id);
  }, []);

  const handleAddSuggestion = useCallback((s: RestockSuggestion) => {
    addToShoppingList(s.name, s.itemId);
  }, [addToShoppingList]);

  const handleRemove = useCallback((item: ShoppingItem) => {
    Alert.alert('Remove item', `Remove "${item.name}" from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromShoppingList(item.id) },
    ]);
  }, [removeFromShoppingList]);

  const handleClearPurchased = useCallback(() => {
    Alert.alert('Clear purchased', `Remove ${purchased.length} purchased item${purchased.length !== 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearPurchased() },
    ]);
  }, [purchased.length, clearPurchased]);

  const onRefresh = useCallback(async () => {
    if (!house) return;
    setRefreshing(true);
    try { await loadHouseData(house.id); } finally { setRefreshing(false); }
  }, [house, loadHouseData]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'to_buy', label: 'To Buy', count: toBuy.length },
    { key: 'purchased', label: 'Purchased', count: purchased.length },
  ];

  const emptyToBuy = toBuy.length === 0 && suggestions.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <CollapsibleHeaderBar
        title="Shopping list"
        scrollY={scrollY}
        right={
          <Tappable
            onPress={() => { setAddItemSearch(''); setAddItemSheet(true); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Add item to list"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accent, borderRadius: theme.radii.pill, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Ionicons name="add" size={16} color={C.onAccent} />
            <Text style={{ color: C.onAccent, fontSize: 13, fontWeight: '600' }}>Add item</Text>
          </Tappable>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerInset, paddingBottom: 200, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
        }
      >
        <LargeTitle title="Shopping list" scrollY={scrollY} />

        {/* Segmented control */}
        <View style={{ flexDirection: 'row', backgroundColor: C.chipBg, borderRadius: theme.radii.md, padding: 4, marginHorizontal: PAD, marginBottom: 4 }}>
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <Tappable
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${t.label}, ${t.count}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: theme.radii.sm, backgroundColor: active ? theme.colors.surface : 'transparent', ...(active ? theme.elevation.raised : null) }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? C.text : C.muted }}>{t.label}</Text>
                <View style={{ minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: theme.radii.pill, backgroundColor: active ? theme.colors.primary : C.border }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', textAlign: 'center', color: active ? C.onAccent : C.muted }}>{t.count}</Text>
                </View>
              </Tappable>
            );
          })}
        </View>

        {tab === 'to_buy' ? (
          emptyToBuy ? (
            <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: PAD }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="basket-outline" size={34} color={C.accent} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '600', color: C.text }}>Nothing to buy yet</Text>
              <Text style={{ fontSize: 15, color: C.muted, marginTop: 6, textAlign: 'center' }}>Search your inventory to add an item.</Text>
            </View>
          ) : (
            <>
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
                      <ShoppingRow item={s} subtitle={s.inventory_id ? categoryById[s.inventory_id] : undefined} onToggle={togglePurchased} onAdjust={adjustShoppingQty} onRemove={handleRemove} />
                      {i < toBuy.length - 1 && <RowSeparator />}
                    </View>
                  ))}
                </>
              )}
            </>
          )
        ) : purchased.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: PAD }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-circle-outline" size={34} color={C.muted} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: C.text }}>No purchased items</Text>
          </View>
        ) : (
          <>
            <SectionLabel label="Purchased" />
            {purchased.map((s, i) => (
              <View key={s.id}>
                <ShoppingRow item={s} subtitle={s.inventory_id ? categoryById[s.inventory_id] : undefined} onToggle={togglePurchased} onAdjust={adjustShoppingQty} onRemove={handleRemove} />
                {i < purchased.length - 1 && <RowSeparator />}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom actions */}
      {tab === 'purchased' && purchased.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: PAD, paddingTop: 12, paddingBottom: insets.bottom + 88 }}>
          <Tappable
            onPress={handleClearPurchased}
            accessibilityRole="button"
            accessibilityLabel="Clear purchased items"
            style={{ borderWidth: 1, borderColor: theme.colors.dangerBorder, borderRadius: theme.radii.md, paddingHorizontal: 16, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.danger, fontWeight: '600', fontSize: 15 }}>Clear</Text>
          </Tappable>
          <Tappable
            onPress={() => {
              const count = purchased.length;
              updatePantry();
              setSnackbar({ message: `${count} item${count !== 1 ? 's' : ''} added to pantry`, canUndo: true });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Update pantry with ${purchased.length} items`}
            style={{ flex: 1, backgroundColor: C.accent, borderRadius: theme.radii.md, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={C.onAccent} />
            <Text style={{ color: C.onAccent, fontWeight: '600', fontSize: 16 }}>
              Update Pantry ({purchased.length})
            </Text>
          </Tappable>
        </View>
      )}

      {snackbar && (
        <View style={{ position: 'absolute', left: PAD, right: PAD, bottom: insets.bottom + 148, minHeight: 52, borderRadius: theme.radii.md, backgroundColor: theme.colors.snackbarBg, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12 }}>
          <Text style={{ flex: 1, color: theme.colors.surface, fontSize: 14 }} numberOfLines={1}>{snackbar.message}</Text>
          {snackbar.canUndo && (
            <Tappable
              onPress={() => { undoLastPantryUpdate(); setSnackbar(null); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Undo"
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text style={{ color: theme.colors.infoSoft, fontSize: 14, fontWeight: '700' }}>Undo</Text>
            </Tappable>
          )}
        </View>
      )}

      {/* Add item sheet */}
      <NativeSheet visible={addItemSheet} onClose={() => setAddItemSheet(false)} snapPoints={['90%']}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: C.text }}>Add item</Text>
            <Tappable onPress={() => setAddItemSheet(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={C.muted} />
            </Tappable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceSunken, borderWidth: 1, borderColor: C.border, borderRadius: theme.radii.md, height: 44, paddingHorizontal: 12 }}>
              <Ionicons name="search-outline" size={18} color={C.faint} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 15, color: C.text, fontFamily: theme.fonts.regular }}
                placeholder="Search inventory…"
                placeholderTextColor={C.faint}
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
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.borderLight, marginLeft: 16, marginRight: 16 }} />}
            ListEmptyComponent={
              addItemSearch.trim().length > 0 ? (
                <Tappable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${addItemSearch.trim()}`}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
                  onPress={() => {
                    addToShoppingList(addItemSearch.trim());
                    setAddItemSheet(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: C.text }}>Add "{addItemSearch.trim()}"</Text>
                    <Text style={{ fontSize: 13, color: C.faint }}>Not in your inventory</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={C.accent} />
                </Tappable>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 15, color: C.faint }}>No items found</Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const alreadyQueued = queuedIds.has(item.id) || queuedNames.has(item.name.toLowerCase());
              return (
                <Tappable
                  accessibilityRole="button"
                  accessibilityLabel={alreadyQueued ? `${item.name}, already added` : `Add ${item.name}`}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, opacity: alreadyQueued ? 0.5 : 1 }}
                  onPress={() => {
                    if (!alreadyQueued) {
                      addToShoppingList(item.name, item.id);
                      setAddItemSheet(false);
                    }
                  }}
                  disabled={alreadyQueued}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: alreadyQueued ? C.faint : C.text }}>{item.name}</Text>
                    <Text style={{ fontSize: 13, color: C.faint }}>{item.category}</Text>
                  </View>
                  {alreadyQueued ? (
                    <Text style={{ fontSize: 13, color: C.faint }}>Added</Text>
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color={C.accent} />
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
