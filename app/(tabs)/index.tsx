import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  SectionList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  RefreshControl,
  Animated,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGleanStore, InventoryItem, DEFAULT_HOUSE_OPTIONS } from '../../store/useGleanStore';
import { theme } from '@/constants/theme';
import { useC, useColors } from '@/lib/appearance';
import { categoryImage } from '@/constants/categoryImages';
import type { ImageSourcePropType } from 'react-native';
import { Tappable } from '../../components/ui/tappable';
import { Text } from '../../components/ui/text';
import {
  CollapsibleHeaderBar,
  LargeTitle,
  useCollapsibleHeader,
  useHeaderContentInset,
} from '../../components/CollapsibleHeader';

// ─── Palette aliases ──────────────────────────────────────────────────────────
// Colors come from useC() inside each component so they react to dark mode.

const PAD = 24;
type Filter = string | null;

// VirtualizedList (SectionList) needs an animated wrapper to accept a native-driver onScroll.
// Cast back to SectionList so its generic prop types survive the wrapper.
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as typeof SectionList;

// Category → icon, for the leading avatar on each row.
const CATEGORY_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = Object.fromEntries(
  DEFAULT_HOUSE_OPTIONS.filter(o => o.type === 'category').map(o => [
    o.name,
    o.icon as React.ComponentProps<typeof Ionicons>['name'],
  ]),
);
const ROW_INSET = 24 + 64 + 14; // screen padding + tile + gap

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({
  label,
  icon,
  image,
  active,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  image?: ImageSourcePropType;
  active: boolean;
  onPress: () => void;
}) {
  const C = useC();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Filter: ${label}`}
      hitSlop={6}
      style={{
        height: 40,
        minWidth: 56,
        borderRadius: theme.radii.pill,
        backgroundColor: active ? C.chipBg : C.card,
        borderWidth: 1,
        borderColor: active ? C.text : C.border,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        gap: 8,
      }}
    >
      {image ? (
        <Image source={image} style={{ width: 22, height: 22 }} resizeMode="contain" />
      ) : icon ? (
        <Ionicons name={icon} size={15} color={active ? C.text : C.muted} />
      ) : null}
      <Text style={{ fontSize: theme.type.label, fontWeight: active ? '600' : '500', color: C.text }}>
        {label}
      </Text>
    </Tappable>
  );
}

// ─── InventoryRow ─────────────────────────────────────────────────────────────
const InventoryRow = React.memo(function InventoryRow({
  item,
  onNavigate,
  onAdjust,
}: {
  item: InventoryItem;
  onNavigate: (itemId: string) => void;
  onAdjust: (itemId: string, delta: number) => void;
}) {
  const C = useC();
  return (
    <Tappable
      onPress={() => onNavigate(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.qty} in stock`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 84,
        paddingHorizontal: PAD,
        paddingVertical: 10,
        gap: 14,
      }}
    >
      {/* Leading thumbnail — item photo, else category art, else icon */}
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={{ width: 64, height: 64, borderRadius: theme.radii.lg, backgroundColor: C.chipBg }}
        />
      ) : (
        <View style={{ width: 64, height: 64, borderRadius: theme.radii.lg, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {categoryImage(item.category) ? (
            <Image source={categoryImage(item.category)!} style={{ width: 54, height: 54 }} resizeMode="contain" />
          ) : (
            <Ionicons
              name={(CATEGORY_ICON[item.category] ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name']}
              size={24}
              color={C.muted}
            />
          )}
        </View>
      )}

      {/* Title + meta line */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: theme.type.body, fontWeight: '600', color: C.text }} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {item.location ? (
            <Text style={{ fontSize: theme.type.label, color: C.muted }} numberOfLines={1}>{item.location}</Text>
          ) : null}
          {item.qty === 0 ? (
            <Text style={{ fontSize: theme.type.sm, fontWeight: '600', color: C.danger }}>Out of stock</Text>
          ) : item.qty === 1 ? (
            <Text style={{ fontSize: theme.type.sm, fontWeight: '600', color: C.warning }}>Low stock</Text>
          ) : null}
        </View>
      </View>

      {/* Quantity steppers — log used/restocked via adjustInventoryQty */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Tappable
          onPress={() => onAdjust(item.id, -1)}
          disabled={item.qty === 0}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${item.name}`}
          hitSlop={10}
          style={{ width: 32, height: 32, borderRadius: theme.radii.pill, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center', opacity: item.qty === 0 ? 0.5 : 1 }}
        >
          <Ionicons name="remove" size={15} color={C.text} />
        </Tappable>
        <Text style={{ fontSize: theme.type.body, fontWeight: '600', color: C.text, fontFamily: theme.fonts.monoMedium, minWidth: 22, textAlign: 'center' }}>
          {item.qty}
        </Text>
        <Tappable
          onPress={() => onAdjust(item.id, 1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${item.name}`}
          hitSlop={10}
          style={{ width: 32, height: 32, borderRadius: theme.radii.pill, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={15} color={theme.colors.onAccent} />
        </Tappable>
      </View>
    </Tappable>
  );
});

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  const C = useC();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingTop: 20, paddingBottom: 8 }}>
      <Text style={{ fontSize: theme.type.caption, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
        {title}
      </Text>
      {count != null ? <Text style={{ fontSize: theme.type.caption, color: C.muted }}>{count}</Text> : null}
    </View>
  );
}

// ─── SearchPill ───────────────────────────────────────────────────────────────
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
  const C = useC();
  return (
    <View style={{ position: 'absolute', left: PAD, right: PAD, bottom: 16, zIndex: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: C.card,
          borderRadius: theme.radii.pill,
          height: 48,
          paddingHorizontal: 16,
          gap: 8,
          borderWidth: 1,
          borderColor: C.borderLight,
          ...theme.elevation.floating,
        }}
      >
        <Ionicons name="search-outline" size={19} color={C.muted} />
        <TextInput
          style={{ flex: 1, fontSize: theme.type.md, color: C.text, fontFamily: theme.fonts.regular }}
          placeholder="Search inventory"
          placeholderTextColor={C.faint}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          accessibilityLabel="Search inventory"
        />
        {query.length > 0 && (
          <Tappable onPress={onClear} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={C.muted} />
          </Tappable>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function InventoryScreen() {
  const { inventory, house, adjustInventoryQty, loadHouseData, loading } = useGleanStore();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useCollapsibleHeader();
  const headerInset = useHeaderContentInset();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Filter>(null);
  const [sortBy, setSortBy] = useState<'name' | 'qty' | 'recent'>('name');
  const [iosKeyboardOpen, setIosKeyboardOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lastNav = useRef(0);
  const shimmer = useRef(new Animated.Value(1)).current;
  const C = useC();
  const colors = useColors();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', () => setIosKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setIosKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const navigateToItem = useCallback((itemId: string) => {
    const now = Date.now();
    if (now - lastNav.current < 400) return;
    lastNav.current = now;
    router.push(`/item-form?itemId=${itemId}`);
  }, []);

  const onRefresh = useCallback(async () => {
    if (!house) return;
    setRefreshing(true);
    try { await loadHouseData(house.id); } finally { setRefreshing(false); }
  }, [house, loadHouseData]);

  const availableCategories = useMemo(() => {
    const cats = new Set(inventory.map(item => item.category));
    return Array.from(cats).sort();
  }, [inventory]);

  const filtered = useMemo(() => inventory.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === null ||
      (selectedCategory === 'out-of-stock' ? item.qty === 0
        : selectedCategory === 'low-stock' ? item.qty === 1
          : item.category === selectedCategory);
    return matchesSearch && matchesCategory;
  }), [inventory, searchQuery, selectedCategory]);

  const sections = useMemo(() => {
    const groups = filtered.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof inventory>);
    const sortItems = (items: typeof inventory) => [...items].sort((a, b) => {
      if (sortBy === 'qty') return a.qty - b.qty || a.name.localeCompare(b.name);
      if (sortBy === 'recent') return (b.last_restocked ?? '').localeCompare(a.last_restocked ?? '') || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return Object.keys(groups)
      .sort()
      .map(category => ({ title: category, data: sortItems(groups[category]) }));
  }, [filtered, sortBy]);

  const openSort = () => {
    Alert.alert('Sort by', undefined, [
      { text: 'Name (A–Z)', onPress: () => setSortBy('name') },
      { text: 'Quantity', onPress: () => setSortBy('qty') },
      { text: 'Recently restocked', onPress: () => setSortBy('recent') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const searchBottom = Platform.OS === 'ios' && iosKeyboardOpen ? 12 : insets.bottom + 88;

  // Skeleton shown on first load; opacity-only shimmer (compositor prop).
  const showSkeleton = loading && inventory.length === 0;
  useEffect(() => {
    if (!showSkeleton) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.5, duration: 200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showSkeleton, shimmer]);

  const skeletonBlock = (
    <Animated.View style={{ opacity: shimmer }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingVertical: 10, gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: theme.radii.lg, backgroundColor: colors.surfaceSunken }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ width: '60%', height: 14, borderRadius: theme.radii.sm, backgroundColor: colors.surfaceSunken }} />
            <View style={{ width: '35%', height: 12, borderRadius: theme.radii.sm, backgroundColor: colors.surfaceSunken }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const headerBlock = (
    <View>
      <LargeTitle title="Inventory" scrollY={scrollY} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: PAD, paddingVertical: 12, gap: 8 }}
      >
        <Chip label="All" icon="grid-outline" active={selectedCategory === null} onPress={() => setSelectedCategory(null)} />
        <Chip label="Low stock" icon="alert-circle-outline" active={selectedCategory === 'low-stock'} onPress={() => setSelectedCategory(selectedCategory === 'low-stock' ? null : 'low-stock')} />
        <Chip label="Out of stock" icon="close-circle-outline" active={selectedCategory === 'out-of-stock'} onPress={() => setSelectedCategory(selectedCategory === 'out-of-stock' ? null : 'out-of-stock')} />
        {availableCategories.map(cat => (
          <Chip key={cat} label={cat} image={categoryImage(cat)} active={selectedCategory === cat} onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)} />
        ))}
      </ScrollView>
    </View>
  );

  const emptyBlock = inventory.length === 0 ? (
    <View style={{ alignItems: 'center', paddingTop: 96, paddingHorizontal: PAD }}>
      <View style={{ width: 72, height: 72, borderRadius: theme.radii.xl, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Ionicons name="basket-outline" size={34} color={C.accent} />
      </View>
      <Text style={{ fontSize: theme.type.xl, fontWeight: '600', color: C.text }}>Add some groceries</Text>
      <Text style={{ fontSize: theme.type.md, color: C.muted, marginTop: 6, textAlign: 'center' }}>
        Tap + to add your first item, or import a CSV from Settings.
      </Text>
      <Tappable
        onPress={() => router.push('/item-form')}
        haptic
        accessibilityRole="button"
        accessibilityLabel="Add new item"
        style={{ marginTop: 24, backgroundColor: C.accent, borderRadius: theme.radii.md, paddingHorizontal: 24, paddingVertical: 14 }}
      >
        <Text style={{ color: theme.colors.onAccent, fontWeight: '600', fontSize: theme.type.md }}>Add new item</Text>
      </Tappable>
    </View>
  ) : (
    <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: PAD }}>
      <Ionicons name="search-outline" size={40} color={C.faint} />
      <Text style={{ fontSize: theme.type.lg, fontWeight: '600', color: C.text, marginTop: 16 }}>No items found</Text>
      <Text style={{ fontSize: theme.type.label, color: C.muted, marginTop: 4 }}>Try a different search or filter</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <CollapsibleHeaderBar
        title="Inventory"
        scrollY={scrollY}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Tappable
              onPress={openSort}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Sort inventory"
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="swap-vertical" size={22} color={C.text} />
            </Tappable>
            <Tappable
              onPress={() => router.push('/item-form')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Add item"
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={26} color={C.accent} />
            </Tappable>
          </View>
        }
      />

      <AnimatedSectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={headerBlock}
        ListEmptyComponent={showSkeleton ? skeletonBlock : emptyBlock}
        contentContainerStyle={{ paddingTop: headerInset, paddingBottom: 160, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
        }
        renderSectionHeader={({ section: { title, data } }) => <SectionHeader title={title} count={data.length} />}
        renderItem={({ item, index, section }) => (
          <View>
            <InventoryRow item={item} onNavigate={navigateToItem} onAdjust={adjustInventoryQty} />
            {index < section.data.length - 1 && (
              <View style={{ height: 1, backgroundColor: C.border, marginLeft: ROW_INSET, marginRight: PAD }} />
            )}
          </View>
        )}
      />

      <SearchPill
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClear={() => setSearchQuery('')}
        bottom={searchBottom}
      />
    </KeyboardAvoidingView>
  );
}
