import React, { useState, useMemo } from 'react';
import { View, SectionList, SectionListData, Pressable, Modal, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGleanStore, InventoryItem, ShoppingItem } from '../../store/useGleanStore';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';

type Tab = 'to_buy' | 'purchased';

// ─── Intelligence: predict finish date from consumption logs ─────────────────

function predictedFinishDate(
  itemName: string,
  currentQty: number,
  logs: ReturnType<typeof useGleanStore.getState>['consumptionLogs']
): Date | null {
  const itemLogs = logs
    .filter(l =>
      l.item_name.toLowerCase() === itemName.toLowerCase() &&
      (!l.action || l.action === 'used')          // ignore 'added'/'restocked' logs
    )
    .sort((a, b) => new Date(a.consumed_at).getTime() - new Date(b.consumed_at).getTime());

  if (itemLogs.length < 2) return null;

  let totalInterval = 0;
  for (let i = 1; i < itemLogs.length; i++) {
    totalInterval +=
      new Date(itemLogs[i].consumed_at).getTime() -
      new Date(itemLogs[i - 1].consumed_at).getTime();
  }
  const avgInterval = totalInterval / (itemLogs.length - 1);
  const lastAt = new Date(itemLogs[itemLogs.length - 1].consumed_at).getTime();
  return new Date(lastAt + avgInterval * Math.max(currentQty, 1));
}

function daysLabel(date: Date): string {
  const diff = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diff <= 0)  return 'today';
  if (diff <= 1)  return 'tomorrow';
  return `in ${Math.ceil(diff)} days`;
}

// ─── Prediction fallback (works with sparse consumption history) ─────────────
//
// When there aren't ≥2 'used' logs, estimate a finish date from a default
// consumption rate per category: perishables ~1 unit/day, staples ~1/3 day.
// Also flags stale restocks (last_restocked > 21 days ago, low stock).

const PERISHABLE_CATEGORIES = new Set(['Dairy', 'Meat & Fish', 'Vegetables', 'Fruits', 'Beverages']);
const DAY_MS = 24 * 60 * 60 * 1000;

function estimateFinishDate(
  itemName: string,
  currentQty: number,
  category: string,
  lastRestocked: string | undefined,
  logs: ReturnType<typeof useGleanStore.getState>['consumptionLogs']
): Date | null {
  // Prefer the history-based estimate when enough logs exist
  const predicted = predictedFinishDate(itemName, currentQty, logs);
  if (predicted) return predicted;

  if (currentQty <= 0) return new Date();

  // Stale stock fallback: restocked a while back and running low
  if (lastRestocked) {
    const restockedDays = (Date.now() - new Date(lastRestocked).getTime()) / DAY_MS;
    if (restockedDays > 21 && currentQty <= 3) {
      return new Date(Date.now() + Math.max(1, currentQty) * DAY_MS);
    }
  }

  // Category-rate fallback
  const ratePerDay = PERISHABLE_CATEGORIES.has(category) ? 1.0 : 1 / 3;
  const finish = Math.max(currentQty, 1) / ratePerDay;
  // Only surface when it's plausibly running low (avoids suggesting everything)
  if (finish > 3) return null;
  return new Date(Date.now() + finish * DAY_MS);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ShoppingScreen() {
  const { inventory, shoppingList, consumptionLogs, addToShoppingList, updateShoppingQty, markAsPurchased, unmarkPurchased, updatePantry } =
    useGleanStore();
  const [activeTab, setActiveTab] = useState<Tab>('to_buy');
  const [addItemSheet, setAddItemSheet] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [allSuggestionsSheet, setAllSuggestionsSheet] = useState(false);

  const toBuy     = shoppingList.filter(i => i.status === 'to_buy');
  const purchased = shoppingList.filter(i => i.status === 'purchased');

  // All shopping list ids and names (across both tabs) for dedup
  const queuedIds   = new Set(shoppingList.map(s => s.inventory_id).filter(Boolean));
  const queuedNames = new Set(shoppingList.map(s => s.name.toLowerCase()));
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

  const suggested = useMemo<InventoryItem[]>(() => {
    const now = Date.now();
    return inventory.filter(item => {
      if (queuedIds.has(item.id)) return false;
      if (queuedNames.has(item.name.toLowerCase())) return false;
      if (item.qty === 0) return true;
      const predicted = estimateFinishDate(
        item.name,
        item.qty,
        item.category,
        item.last_restocked,
        consumptionLogs
      );
      if (!predicted) return false;
      return predicted.getTime() - now <= TWO_DAYS;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, consumptionLogs, shoppingList]);

  const addItemResults = useMemo(() => {
    const q = addItemSearch.trim().toLowerCase();
    return inventory.filter(item =>
      !q || item.name.toLowerCase().includes(q)
    );
  }, [inventory, addItemSearch]);

  // SectionList data for To Buy tab
  const toBuySections = useMemo<SectionListData<InventoryItem | ShoppingItem>[]>(() => {
    const sections = [];
    if (suggested.length > 0) sections.push({ key: 'suggested', title: 'Suggested', data: suggested });
    sections.push({ key: 'to_buy', title: toBuy.length > 0 ? 'To Buy' : '', data: toBuy });
    return sections;
  }, [suggested, toBuy]);

  return (
    <View className="flex-1 bg-white">

      {/* Page title */}
      <View className="px-6 pt-14 pb-4">
        <Heading size="xl" className="text-gray-900">Shopping list</Heading>
      </View>

      {/* Sub-tabs */}
      <View className="px-6 pb-4">
        <HStack className="bg-slate-100 rounded-xl p-1">
          <TabButton
            label="To Buy"
            count={toBuy.length}
            active={activeTab === 'to_buy'}
            onPress={() => setActiveTab('to_buy')}
          />
          <TabButton
            label="Purchased"
            count={purchased.length}
            active={activeTab === 'purchased'}
            onPress={() => setActiveTab('purchased')}
          />
        </HStack>
      </View>

      {/* ── To Buy tab ── */}
      {activeTab === 'to_buy' && (
        <>
          {suggested.length === 0 && toBuy.length === 0 ? (
            <View className="flex-1 items-center justify-center pb-20">
              <Ionicons name="basket-outline" size={48} color="#CBD5E1" />
              <Text className="text-slate-400 text-sm mt-3">Nothing to buy yet.</Text>
              <Pressable
                className="mt-4 bg-slate-900 rounded-xl px-5 py-3"
                onPress={() => { setAddItemSearch(''); setAddItemSheet(true); }}
              >
                <Text className="text-white text-sm font-semibold">Add item</Text>
              </Pressable>
            </View>
          ) : (
            <SectionList
              sections={toBuySections}
              keyExtractor={item => (item as InventoryItem).id ?? (item as typeof toBuy[0]).id}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderSectionHeader={({ section: { title } }) =>
                title ? (
                  <HStack className="items-center gap-2 px-6 py-2 bg-slate-50">
                    <Ionicons
                      name={title === 'Suggested' ? 'bulb-outline' : 'cart-outline'}
                      size={14}
                      color={title === 'Suggested' ? '#F59E0B' : '#94A3B8'}
                    />
                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {title}
                    </Text>
                  </HStack>
                ) : null
              }
              renderItem={({ item, section }) => {
                if (section.key === 'suggested') {
                  const inv = item as InventoryItem;
                  const predicted = estimateFinishDate(
                    inv.name,
                    inv.qty,
                    inv.category,
                    inv.last_restocked,
                    consumptionLogs
                  );
                  return (
                    <HStack className="items-center px-6 py-3">
                      <VStack className="flex-1">
                        <Text className="text-sm font-medium text-gray-900">{inv.name}</Text>
                        {predicted && (
                          <Text className="text-xs text-amber-500">
                            Predicted to finish {daysLabel(predicted)}
                          </Text>
                        )}
                      </VStack>
                      <Pressable
                        className="bg-slate-900 rounded-lg px-3 py-1"
                        onPress={() => addToShoppingList(inv.name, inv.id)}
                      >
                        <Text className="text-white text-xs font-semibold">+ Add</Text>
                      </Pressable>
                    </HStack>
                  );
                }

                const s = item as typeof toBuy[0];
                return (
                  <HStack className="items-center px-6 py-4 gap-3">
                    <Pressable onPress={() => markAsPurchased(s.id)}>
                      <View className="w-6 h-6 rounded-md border-2 border-gray-300 items-center justify-center" />
                    </Pressable>
                    <Text className="flex-1 text-sm font-medium text-gray-900">{s.name}</Text>
                    <HStack className="items-center gap-2">
                      <Pressable
                        onPress={() => updateShoppingQty(s.id, s.target_qty - 1)}
                        disabled={s.target_qty <= 1}
                        style={{ opacity: s.target_qty <= 1 ? 0.3 : 1 }}
                        className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Ionicons name="remove" size={14} color="#374151" />
                      </Pressable>
                      <Text className="text-sm font-semibold text-gray-900 w-5 text-center">
                        {s.target_qty}
                      </Text>
                      <Pressable
                        onPress={() => updateShoppingQty(s.id, s.target_qty + 1)}
                        className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Ionicons name="add" size={14} color="#374151" />
                      </Pressable>
                    </HStack>
                  </HStack>
                );
              }}
              ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-6" />}
            />
          )}
        </>
      )}

      {/* ── Purchased tab ── */}
      {activeTab === 'purchased' && (
        <>
          {purchased.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" message="No purchased items." />
          ) : (
            <SectionList
              sections={[{ key: 'purchased', title: '', data: purchased }]}
              keyExtractor={item => (item as typeof purchased[0]).id}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              renderSectionHeader={() => null}
              renderItem={({ item: s }) => (
                <HStack className="items-center px-6 py-4">
                  <Pressable className="mr-4" onPress={() => unmarkPurchased(s.id)}>
                    <View className="w-6 h-6 rounded-md bg-emerald-500 border-2 border-emerald-500 items-center justify-center">
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  </Pressable>
                  <VStack className="flex-1">
                    <Text className="text-sm font-medium text-gray-400 line-through">{s.name}</Text>
                    <Text className="text-xs text-gray-400">Qty: {s.target_qty}</Text>
                  </VStack>
                </HStack>
              )}
              ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-6" />}
            />
          )}

          {/* Update Pantry CTA */}
          {purchased.length > 0 && (
            <View className="absolute bottom-6 left-6 right-6">
              <Pressable
                className="bg-slate-900 rounded-xl h-11 flex-row items-center justify-center gap-2 px-6"
                onPress={updatePantry}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text className="text-white font-semibold text-lg">
                  Update Pantry ({purchased.length} item{purchased.length !== 1 ? 's' : ''})
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {/* Add item sheet */}
      <Modal
        visible={addItemSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setAddItemSheet(false)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setAddItemSheet(false)} />
        <View className="bg-white rounded-t-2xl" style={{ maxHeight: '75%' }}>
          {/* Handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 bg-gray-300 rounded-full" />
          </View>

          {/* Header */}
          <HStack className="items-center px-6 py-4">
            <Text className="flex-1 text-base font-semibold text-gray-900">Add item</Text>
            <Pressable onPress={() => setAddItemSheet(false)} hitSlop={12}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </HStack>

          {/* Search */}
          <View className="px-6 pb-3">
            <HStack className="items-center bg-gray-100 border border-gray-200 rounded-xl px-3 h-11">
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                className="flex-1 ml-2 text-sm text-gray-800"
                placeholder="Search inventory…"
                placeholderTextColor="#9CA3AF"
                value={addItemSearch}
                onChangeText={setAddItemSearch}
                autoFocus
              />
            </HStack>
          </View>

          {/* Results */}
          <FlatList
            data={addItemResults}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-6" />}
            ListEmptyComponent={
              addItemSearch.trim().length > 0 ? (
                <Pressable
                  className="flex-row items-center px-6 py-4"
                  onPress={() => {
                    addToShoppingList(addItemSearch.trim());
                    setAddItemSheet(false);
                  }}
                >
                  <VStack className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">
                      Add "{addItemSearch.trim()}"
                    </Text>
                    <Text className="text-xs text-gray-400">Not in your inventory</Text>
                  </VStack>
                  <Ionicons name="add-circle-outline" size={22} color="#141C2D" />
                </Pressable>
              ) : (
                <View className="items-center py-10">
                  <Text className="text-sm text-gray-400">No items found</Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const alreadyQueued = queuedIds.has(item.id) || queuedNames.has(item.name.toLowerCase());
              return (
                <Pressable
                  className="flex-row items-center px-6 py-4"
                  onPress={() => {
                    if (!alreadyQueued) {
                      addToShoppingList(item.name, item.id);
                      setAddItemSheet(false);
                    }
                  }}
                  disabled={alreadyQueued}
                >
                  <VStack className="flex-1">
                    <Text className={`text-sm font-medium ${alreadyQueued ? 'text-gray-300' : 'text-gray-900'}`}>
                      {item.name}
                    </Text>
                    <Text className="text-xs text-gray-400">{item.category}</Text>
                  </VStack>
                  {alreadyQueued ? (
                    <Text className="text-xs text-gray-300">Added</Text>
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color="#141C2D" />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`flex-1 py-2 rounded-lg items-center flex-row justify-center gap-1 ${active ? 'bg-white shadow-sm' : ''}`}
      onPress={onPress}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-400'}`}>
        {label}
      </Text>
      {count > 0 && (
        <View className={`rounded-full px-1.5 py-0.5 ${active ? 'bg-slate-900' : 'bg-slate-300'}`}>
          <Text className="text-white text-xs font-bold">{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function EmptyState({ icon, message }: { icon: React.ComponentProps<typeof Ionicons>['name']; message: string }) {
  return (
    <View className="flex-1 items-center justify-center pb-20">
      <Ionicons name={icon} size={48} color="#CBD5E1" />
      <Text className="text-slate-400 text-sm mt-3">{message}</Text>
    </View>
  );
}
