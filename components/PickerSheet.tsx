import React, { useEffect, useState } from 'react';
import { View, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeSheet } from './NativeSheet';
import { Tappable } from './ui/tappable';
import { Text } from './ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { type HouseOption, type HouseOptionType } from '@/store/useGleanStore';

/**
 * Searchable option picker for categories/locations with inline "add new".
 * Shared by the item form and the barcode scanner so both behave identically.
 */
export function PickerSheet({
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
  const colors = useColors();
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
          <Text style={{ flex: 1, fontSize: theme.type.body, fontWeight: '600', color: colors.text }}>{title}</Text>
          <Tappable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Tappable>
        </View>
        <View style={{ marginHorizontal: 16, marginBottom: 8, height: 44, borderRadius: theme.radii.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <Ionicons name="search-outline" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${type}s`}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            style={{ flex: 1, marginLeft: 8, fontSize: theme.type.label, color: colors.text, fontFamily: theme.fonts.regular }}
          />
        </View>
        <FlatList
          data={filteredOptions}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.surfaceSunken, marginLeft: 16, marginRight: 16 }} />}
          renderItem={({ item }) => (
            <Tappable
              onPress={() => onSelect(item.name)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
            >
              <Ionicons name={item.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color={colors.textMuted} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, fontSize: theme.type.label, color: colors.text }}>{item.name}</Text>
              {selected === item.name && <Ionicons name="checkmark" size={18} color={colors.accent} />}
            </Tappable>
          )}
          ListEmptyComponent={normalizedQuery && exactMatch ? null : <Text style={{ padding: 24, textAlign: 'center', color: colors.textFaint }}>No {type}s found</Text>}
        />
        {normalizedQuery && !exactMatch && (
          <Tappable
            onPress={() => onCreate(query)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${query.trim()}`}
            style={{ height: 44, marginHorizontal: 16, marginBottom: 16, borderRadius: theme.radii.md, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.onAccent} />
            <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: colors.onAccent }}>Add “{query.trim()}”</Text>
          </Tappable>
        )}
      </View>
    </NativeSheet>
  );
}
