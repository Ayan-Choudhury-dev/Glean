import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TextInput, FlatList, RefreshControl, Animated, Share, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Svg, Path, Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tappable } from '../../components/ui/tappable';
import { Text } from '../../components/ui/text';
import { CollapsibleHeaderBar, LargeTitle, useCollapsibleHeader, useHeaderContentInset } from '../../components/CollapsibleHeader';
import { NativeSheet } from '../../components/NativeSheet';
import { useGleanStore, ShoppingItem } from '../../store/useGleanStore';
import { getRestockSuggestions, type RestockSuggestion } from '../../lib/predictions';
import { categoryImage } from '@/constants/categoryImages';
import { theme } from '@/constants/theme';
import { FEATURES } from '@/constants/config';
import { useC, useColors } from '@/lib/appearance';
import { showDialog } from '@/lib/overlay';

const PAD = 24;
type Tab = 'to_buy' | 'purchased';

const RowSeparator = () => {
  const C = useC();
  return <View style={{ height: 1, backgroundColor: C.border, marginLeft: PAD + 38, marginRight: PAD }} />;
};

const ShoppingRow = React.memo(function ShoppingRow({
  item,
  subtitle,
  image,
  category,
  onToggle,
  onAdjust,
  onRemove,
}: {
  item: ShoppingItem;
  subtitle?: string;
  image?: string;
  category?: string;
  onToggle: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (item: ShoppingItem) => void;
}) {
  const C = useC();
  const colors = useColors();
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
        <View style={{ width: 26, height: 26, borderRadius: theme.radii.sm, borderWidth: 2, borderColor: purchased ? C.accent : colors.borderStrong, backgroundColor: purchased ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {purchased && <Ionicons name="checkmark" size={15} color={C.onAccent} />}
        </View>
      </Tappable>

      {image ? (
        <Image source={{ uri: image }} style={{ width: 40, height: 40, borderRadius: theme.radii.sm, backgroundColor: colors.surfaceSunken }} />
      ) : categoryImage(category ?? '') ? (
        <View style={{ width: 40, height: 40, borderRadius: theme.radii.sm, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Image source={categoryImage(category ?? '')!} style={{ width: 34, height: 34 }} resizeMode="contain" />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: theme.type.body, fontWeight: '600', color: purchased ? C.faint : C.text, textDecorationLine: purchased ? 'line-through' : 'none' }} numberOfLines={1}>{item.name}</Text>
        {purchased ? (
          <Text style={{ fontSize: theme.type.label, color: C.faint }}>Quantity {item.target_qty}</Text>
        ) : subtitle ? (
          <Text style={{ fontSize: theme.type.label, color: C.muted }} numberOfLines={1}>{subtitle}</Text>
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
          <Text style={{ fontSize: theme.type.body, fontWeight: '600', color: C.text, fontFamily: theme.fonts.monoMedium, minWidth: 22, textAlign: 'center' }}>{item.target_qty}</Text>
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
  const C = useC();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingVertical: 14, gap: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: theme.radii.pill, backgroundColor: C.warningBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="bulb-outline" size={16} color={C.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: theme.type.md, fontWeight: '500', color: C.text }}>{suggestion.name}</Text>
        <Text style={{ fontSize: theme.type.caption, color: C.warning, marginTop: 2 }}>Predicted to finish {suggestion.label}</Text>
      </View>
      <Tappable
        onPress={() => onAdd(suggestion)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Add ${suggestion.name} to list`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: theme.radii.pill, paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Ionicons name="add" size={14} color={C.accent} />
        <Text style={{ fontSize: theme.type.sm, fontWeight: '600', color: C.accent }}>Add</Text>
      </Tappable>
    </View>
  );
});

function SectionLabel({ label }: { label: string }) {
  const C = useC();
  return (
    <View style={{ paddingHorizontal: PAD, paddingTop: 16, paddingBottom: 4 }}>
      <Text style={{ fontSize: theme.type.caption, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</Text>
    </View>
  );
}

const DashedSeparator = () => {
  const C = useC();
  return <View style={{ height: 0, borderTopWidth: 1, borderTopColor: C.border, borderStyle: 'dashed', marginHorizontal: 16 }} />;
};

/** Full-bleed notebook rule between to-do rows. */
const PaperRule = () => {
  const C = useC();
  return <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 0 }} />;
};

const RECEIPT_TEETH = 20;

/** Torn receipt edge: fill-only triangles, no top rule. */
const ReceiptTeeth = ({ fill }: { fill: string }) => {
  const teeth = Array.from({ length: RECEIPT_TEETH }, (_, i) => `L ${i * 20 + 10} 10 L ${(i + 1) * 20} 0`).join(' ');
  return (
    <Svg width="100%" height="10" viewBox={`0 0 ${RECEIPT_TEETH * 20} 10`} preserveAspectRatio="none" style={{ marginTop: -1 }}>
      <Path d={`M 0 0 ${teeth} Z`} fill={fill} stroke="none" />
    </Svg>
  );
};

/** Subtle dot-grain paper texture overlay. */
const PaperTexture = ({ color }: { color: string }) => (
  <Svg width="100%" height="100%" pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
    <Defs>
      <Pattern id="paperDots" width="12" height="12" patternUnits="userSpaceOnUse">
        <Circle cx="2" cy="2" r="1" fill={color} opacity={0.06} />
      </Pattern>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#paperDots)" />
  </Svg>
);

/** To Buy renders as a clean paper sheet with ruled rows. */
const PaperCard = ({ children }: { children: React.ReactNode }) => {
  const C = useC();
  return (
    <View style={{ marginHorizontal: PAD, marginTop: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: theme.radii.lg, overflow: 'hidden' }}>
      {children}
    </View>
  );
};

/** Purchased renders as a store receipt: dashed rules, mono meta, total footer. */
const ReceiptCard = ({ count, children }: { count: number; children: React.ReactNode }) => {
  const C = useC();
  const colors = useColors();
  const paper = colors.surfaceSunken;
  const today = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <View style={{ marginHorizontal: PAD, marginTop: 12 }}>
      <View style={{ backgroundColor: paper, borderTopLeftRadius: theme.radii.sm, borderTopRightRadius: theme.radii.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10 }}>
      <View style={{ borderTopLeftRadius: theme.radii.sm, borderTopRightRadius: theme.radii.sm, overflow: 'hidden' }}>
        <PaperTexture color={C.muted} />
        <View style={{ alignItems: 'center', paddingVertical: 12, gap: 2 }}>
          <Ionicons name="receipt-outline" size={20} color={C.muted} />
          <Text style={{ fontSize: theme.type.caption, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5 }}>Receipt</Text>
          <Text style={{ fontSize: theme.type.caption, color: C.faint, fontFamily: theme.fonts.monoMedium }}>{today} · {count} item{count !== 1 ? 's' : ''}</Text>
        </View>
        <DashedSeparator />
        {children}
        <DashedSeparator />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: C.text }}>Total items</Text>
          <Text style={{ fontSize: theme.type.label, fontWeight: '700', color: C.text, fontFamily: theme.fonts.monoMedium, fontVariant: ['tabular-nums'] }}>{count}</Text>
        </View>
      </View>
      </View>
      <ReceiptTeeth fill={paper} />
    </View>
  );
};

export default function ShoppingScreen() {
  const {
    inventory, shoppingList, consumptionLogs, house,
    addToShoppingList, adjustShoppingQty, updatePantry, undoLastPantryUpdate,
    removeFromShoppingList, clearPurchased, loadHouseData,
  } = useGleanStore();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useCollapsibleHeader();
  const headerInset = useHeaderContentInset();
  const C = useC();
  const colors = useColors();
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

  const itemById = useMemo(
    () => Object.fromEntries(inventory.map(i => [i.id, i])) as Record<string, (typeof inventory)[number]>,
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
    showDialog({
      title: 'Remove item',
      message: `Remove "${item.name}" from your list?`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => removeFromShoppingList(item.id),
    });
  }, [removeFromShoppingList]);

  const handleClearPurchased = useCallback(() => {
    showDialog({
      title: 'Clear purchased',
      message: `Remove ${purchased.length} purchased item${purchased.length !== 1 ? 's' : ''}?`,
      confirmLabel: 'Clear',
      destructive: true,
      onConfirm: () => clearPurchased(),
    });
  }, [purchased.length, clearPurchased]);

  const shareList = useCallback(async () => {
    if (toBuy.length === 0) return;
    const message = `Shopping list (${toBuy.length})\n` + toBuy.map(i => `• ${i.name} ×${i.target_qty}`).join('\n');
    await Share.share({ message });
  }, [toBuy]);

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CollapsibleHeaderBar
        title="Shopping list"
        scrollY={scrollY}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Tappable
              onPress={shareList}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share shopping list"
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="share-outline" size={22} color={C.text} />
            </Tappable>
            <Tappable
              onPress={() => router.push('/scan')}
              haptic
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Add item to list"
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={26} color={C.accent} />
            </Tappable>
          </View>
        }
      />

      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerInset, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
        }
      >
        <LargeTitle title="Shopping list" scrollY={scrollY} />

        {/* Filter chips — uniform with Inventory */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: PAD, marginBottom: 4 }}>
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <Tappable
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${t.label}, ${t.count}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: theme.radii.pill, backgroundColor: active ? C.chipBg : C.card, borderWidth: 1, borderColor: active ? C.text : C.border }}
              >
                <Text style={{ fontSize: theme.type.label, fontWeight: active ? '600' : '500', color: C.text }}>{t.label}</Text>
                <Text style={{ fontSize: theme.type.micro, fontWeight: '700', color: active ? C.text : C.muted, fontFamily: theme.fonts.monoMedium, fontVariant: ['tabular-nums'] }}>{t.count}</Text>
              </Tappable>
            );
          })}
        </View>

        {tab === 'to_buy' ? (
          emptyToBuy ? (
            <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: PAD }}>
              <View style={{ width: 72, height: 72, borderRadius: theme.radii.xl, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="basket-outline" size={34} color={C.accent} />
              </View>
              <Text style={{ fontSize: theme.type.lg, fontWeight: '600', color: C.text }}>Nothing to buy yet</Text>
              <Text style={{ fontSize: theme.type.md, color: C.muted, marginTop: 6, textAlign: 'center' }}>Search your inventory to add an item.</Text>
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
                <PaperCard>
                  {toBuy.map((s, i) => (
                    <View key={s.id}>
                      <ShoppingRow item={s} subtitle={s.inventory_id ? categoryById[s.inventory_id] : undefined} image={s.inventory_id ? itemById[s.inventory_id]?.image_url : undefined} category={s.inventory_id ? itemById[s.inventory_id]?.category : undefined} onToggle={togglePurchased} onAdjust={adjustShoppingQty} onRemove={handleRemove} />
                      {i < toBuy.length - 1 && <PaperRule />}
                    </View>
                  ))}
                </PaperCard>
              )}
            </>
          )
        ) : purchased.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: PAD }}>
            <View style={{ width: 72, height: 72, borderRadius: theme.radii.xl, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-circle-outline" size={34} color={C.muted} />
            </View>
            <Text style={{ fontSize: theme.type.lg, fontWeight: '600', color: C.text }}>No purchased items</Text>
          </View>
        ) : (
          <ReceiptCard count={purchased.length}>
            {purchased.map((s, i) => (
              <View key={s.id}>
                <ShoppingRow item={s} subtitle={s.inventory_id ? categoryById[s.inventory_id] : undefined} image={s.inventory_id ? itemById[s.inventory_id]?.image_url : undefined} category={s.inventory_id ? itemById[s.inventory_id]?.category : undefined} onToggle={togglePurchased} onAdjust={adjustShoppingQty} onRemove={handleRemove} />
                {i < purchased.length - 1 && <DashedSeparator />}
              </View>
            ))}
          </ReceiptCard>
        )}
      </Animated.ScrollView>

      {/* Bottom actions — docked footer above tab bar, not floating */}
      {tab === 'purchased' && purchased.length > 0 && (
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', gap: 10, paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 12 }}>
          <Tappable
            onPress={handleClearPurchased}
            accessibilityRole="button"
            accessibilityLabel="Clear purchased items"
            style={{ borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: theme.radii.md, paddingHorizontal: 16, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.danger, fontWeight: '600', fontSize: theme.type.md }}>Clear</Text>
          </Tappable>
          <Tappable
            onPress={() => {
              const count = purchased.length;
              updatePantry();
              setSnackbar({ message: `${count} item${count !== 1 ? 's' : ''} added to pantry`, canUndo: true });
            }}
            haptic
            accessibilityRole="button"
            accessibilityLabel={`Update pantry with ${purchased.length} items`}
            style={{ flex: 1, backgroundColor: C.accent, borderRadius: theme.radii.md, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={C.onAccent} />
            <Text style={{ color: C.onAccent, fontWeight: '600', fontSize: theme.type.body }}>
              Update Pantry ({purchased.length})
            </Text>
          </Tappable>
        </View>
      )}

      {snackbar && (
        <View style={{ position: 'absolute', left: PAD, right: PAD, bottom: insets.bottom + 88, minHeight: 52, borderRadius: theme.radii.md, backgroundColor: colors.snackbarBg, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12 }}>
          <Text style={{ flex: 1, color: colors.surface, fontSize: theme.type.label }} numberOfLines={1}>{snackbar.message}</Text>
          {snackbar.canUndo && (
            <Tappable
              onPress={() => { undoLastPantryUpdate(); setSnackbar(null); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Undo"
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text style={{ color: colors.infoSoft, fontSize: theme.type.label, fontWeight: '700' }}>Undo</Text>
            </Tappable>
          )}
        </View>
      )}

      {/* Add item sheet */}
      <NativeSheet visible={addItemSheet} onClose={() => setAddItemSheet(false)} snapPoints={['90%']}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: theme.type.lg, fontWeight: '600', color: C.text }}>Add item</Text>
            <Tappable onPress={() => setAddItemSheet(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={C.muted} />
            </Tappable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: C.border, borderRadius: theme.radii.md, height: 44, paddingHorizontal: 12 }}>
              <Ionicons name="search-outline" size={18} color={C.faint} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: theme.type.md, color: C.text, fontFamily: theme.fonts.regular }}
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
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 16, marginRight: 16 }} />}
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
                    <Text style={{ fontSize: theme.type.md, fontWeight: '500', color: C.text }}>Add "{addItemSearch.trim()}"</Text>
                    <Text style={{ fontSize: theme.type.sm, color: C.faint }}>Not in your inventory</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={C.accent} />
                </Tappable>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: theme.type.md, color: C.faint }}>No items found</Text>
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
                    <Text style={{ fontSize: theme.type.md, fontWeight: '500', color: alreadyQueued ? C.faint : C.text }}>{item.name}</Text>
                    <Text style={{ fontSize: theme.type.sm, color: C.faint }}>{item.category}</Text>
                  </View>
                  {alreadyQueued ? (
                    <Text style={{ fontSize: theme.type.sm, color: C.faint }}>Added</Text>
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
