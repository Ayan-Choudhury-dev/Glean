import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore, InventoryItem } from '../../store/useGleanStore';


// ─── Palette ──────────────────────────────────────────────────────────────────
// All hardcoded colors live here so screens stay consistent. When migrating to
// Color from expo-router, replace these with the semantic equivalents.
const C = {
  bg: '#FAFAFA',
  card: '#FFFFFF',
  text: '#0A0A0A',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E5E7EB',
  borderLight: '#E2E8F0',
  chipBg: '#F1F5F9',
  chipActive: '#0F172A',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  green: '#10B981',
  sectionBg: '#F8FAFC',
} as const;

// ─── Chip ─────────────────────────────────────────────────────────────────────
// Filter pill. Colors on a plain-object View; Pressable only handles press feedback.
function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        height: 40,
        minWidth: 56,
        borderRadius: 999,
        backgroundColor: active ? '#0F172A' : '#FFFFFF',
        borderWidth: 1,
        borderColor: active ? 'transparent' : '#E5E7EB',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : '#64748B'} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: active ? '#FFFFFF' : '#0A0A0A' }}>
            {label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

// ─── InventoryRow ─────────────────────────────────────────────────────────────
// Single inventory row. Tap opens item detail. Shows name, optional location,
// stock badges (out-of-stock / low-stock), and a tabular-nums quantity.
const InventoryRow = React.memo(function InventoryRow({
  item,
  onNavigate,
  onAdjust,
}: {
  item: InventoryItem;
  onNavigate: (itemId: string) => void;
  onAdjust: (itemId: string, delta: number) => void;
}) {
  return (
    <Pressable
      onPress={() => onNavigate(item.id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 64,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
      }}
    >
      {/* Name, location, and stock badge */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: C.text }} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {item.location ? (
            <Text style={{ fontSize: 12, color: C.faint }} numberOfLines={1}>{item.location}</Text>
          ) : null}
          {item.qty === 0 ? (
            <View style={{ backgroundColor: C.dangerBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: C.danger }}>Out of stock</Text>
            </View>
          ) : item.qty === 1 ? (
            <View style={{ backgroundColor: C.warningBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: C.warning }}>Low stock</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Location column */}
      {item.location ? (
        <Text style={{ width: 80, textAlign: 'right', fontSize: 12, color: C.faint }} numberOfLines={1}>{item.location}</Text>
      ) : null}

      {/* Quantity steppers — log used/restocked via adjustInventoryQty */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={() => onAdjust(item.id, -1)}
          disabled={item.qty === 0}
          hitSlop={6}
          style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', opacity: item.qty === 0 ? 0.3 : 1 }}
        >
          <Ionicons name="remove" size={14} color="#374151" />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'], minWidth: 20, textAlign: 'center' }}>
          {item.qty}
        </Text>
        <Pressable
          onPress={() => onAdjust(item.id, 1)}
          hitSlop={6}
          style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: C.chipActive, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
});

// ─── SectionHeader ────────────────────────────────────────────────────────────
// Category group divider shown when a specific category filter is active.
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ height: 40, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 12 }}>
      <Ionicons name="leaf-outline" size={16} color={C.green} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5 }}>
        {title}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
    </View>
  );
}

// ─── SearchPill ───────────────────────────────────────────────────────────────
// Floating search bar above the tab bar. Moves above keyboard on iOS via
// the `bottom` prop driven by the keyboardWillShow/Hide listener.
function SearchPill({
  query,
  onQueryChange,
  onClear,
  bottom,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onClear: () => void;
  bottom: number;
}) {
  return (
    <View style={{ position: 'absolute', left: 24, right: 24, bottom: 16, zIndex: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: C.card,
          borderRadius: 999,
          height: 48,
          paddingHorizontal: 16,
          gap: 8,
          borderWidth: 1,
          borderColor: C.borderLight,
          shadowColor: C.chipActive,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Ionicons name="search-outline" size={19} color={C.muted} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: C.text }}
          placeholder="Search inventory"
          placeholderTextColor={C.faint}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={C.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function InventoryScreen() {
  const { inventory, adjustInventoryQty } = useGleanStore();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [iosKeyboardOpen, setIosKeyboardOpen] = useState(false);
  const lastNav = useRef(0);

  // iOS only: reposition search pill when keyboard opens
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', () => setIosKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setIosKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Debounce rapid taps to prevent double-navigation
  const navigateToItem = useCallback((itemId: string) => {
    const now = Date.now();
    if (now - lastNav.current < 400) return;
    lastNav.current = now;
    router.push(`/item-form?itemId=${itemId}`);
  }, []);

  // Derive unique category names for the chip rail
  const availableCategories = useMemo(() => {
    const cats = new Set(inventory.map(item => item.category));
    return Array.from(cats).sort();
  }, [inventory]);

  // Filter by search text + active category chip
  const filtered = useMemo(() => inventory.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === null ||
      (selectedCategory === 'out-of-stock' ? item.qty === 0 : item.category === selectedCategory);
    return matchesSearch && matchesCategory;
  }), [inventory, searchQuery, selectedCategory]);

  // Grouped by category (sorted) — matches the design's sectioned list
  const sections = useMemo(() => {
    const groups = filtered.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof inventory>);

    return Object.keys(groups)
      .sort()
      .map(category => ({ title: category, data: groups[category].sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [filtered]);

  const searchBottom = Platform.OS === 'ios' && iosKeyboardOpen ? 12 : insets.bottom + 88;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {inventory.length === 0 ? (
          /* ── Empty state: no items yet ── */
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '600', color: C.faint }}>Add some groceries</Text>
            <Text style={{ fontSize: 14, color: C.faint, marginTop: 8 }}>Click the button below to add an item</Text>
            <Pressable
              onPress={() => router.push('/item-form')}
              style={{ marginTop: 24, backgroundColor: C.chipActive, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>Add new item</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Main content: header → chips → list → search pill ── */
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ height: 64 + insets.top, paddingTop: insets.top  }}>
              <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: '600', color: C.chipActive }}>Inventory</Text>
                <Pressable
                  onPress={() => router.push('/item-form')}
                  hitSlop={8}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="add" size={24} color={C.chipActive} />
                </Pressable>
              </View>
            </View>

            {/* Category filter chips — horizontal scroll */}
            <ScrollView
              horizontal
              style={{ flexGrow: 0, flexShrink: 0 }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: C.card }}
            >
              <Chip label="All" icon="grid-outline" active={selectedCategory === null} onPress={() => setSelectedCategory(null)} />
              <Chip label="Out of stock" icon="alert-circle-outline" active={selectedCategory === 'out-of-stock'} onPress={() => setSelectedCategory('out-of-stock')} />
              {availableCategories.map(cat => (
                <Chip key={cat} label={cat} icon="pricetag-outline" active={selectedCategory === cat} onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)} />
              ))}
            </ScrollView>

            {/* Section list or no-results */}
            {sections.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 64 }}>
                <Ionicons name="search-outline" size={40} color="#D1D5DB" />
                <Text style={{ fontSize: 18, fontWeight: '600', color: C.faint, marginTop: 16 }}>No items found</Text>
                <Text style={{ fontSize: 14, color: C.faint, marginTop: 4 }}>Try a different search or filter</Text>
              </View>
            ) : (
              <SectionList
                style={{ flex: 1 }}
                sections={sections}
                keyExtractor={item => item.id}
                stickySectionHeadersEnabled={false}
                contentInsetAdjustmentBehavior="automatic"
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160, marginTop: 24 }}
                renderSectionHeader={({ section: { title } }) => <SectionHeader title={title} />}
                renderItem={({ item }) => <InventoryRow item={item} onNavigate={navigateToItem} onAdjust={adjustInventoryQty} />}
              />
            )}

            {/* Floating search pill — positioned above tab bar or keyboard */}
            <SearchPill
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              bottom={searchBottom}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
