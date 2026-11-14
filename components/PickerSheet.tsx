import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ListSheet, type ListSheetHandle } from './ListSheet';
import { Tappable } from './ui/tappable';
import { Text } from './ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { type HouseOption, type HouseOptionType } from '@/store/useGleanStore';

/**
 * Searchable option picker for categories/locations with inline "add new".
 * Shared by the item form and the barcode scanner so both behave identically.
 *
 * Rendered in the gesture sheet: the list scrolls, and the sheet follows the
 * finger when the list reaches the top, in one gesture.
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
  const sheetRef = useRef<ListSheetHandle>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter(option => option.name.toLowerCase().includes(normalizedQuery));
  const exactMatch = options.some(option => option.name.toLowerCase() === normalizedQuery);

  // The parent still drives visibility with a boolean; the sheet owns its own
  // animation, so mirror it.
  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  return (
    <ListSheet
      ref={sheetRef}
      title={title}
      onDismiss={onClose}
      footer={
        normalizedQuery && !exactMatch ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10, backgroundColor: colors.surface }}>
            <Tappable
              onPress={() => onCreate(query)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${query.trim()}`}
              style={{ height: 48, borderRadius: theme.radii.md, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.onAccent} />
              <Text style={{ fontSize: theme.type.label, fontWeight: '600', color: colors.onAccent }}>Add “{query.trim()}”</Text>
            </Tappable>
          </View>
        ) : null
      }
    >
      <View style={{ marginHorizontal: 20, marginBottom: 12, height: 48, borderRadius: theme.radii.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
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

      {filteredOptions.map((item, index) => (
        <View key={item.id}>
          {index > 0 && <View style={{ height: 1, backgroundColor: colors.surfaceSunken, marginLeft: 20, marginRight: 20 }} />}
          <Tappable
            onPress={() => onSelect(item.name)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
          >
            <Ionicons name={item.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color={colors.textMuted} style={{ marginRight: 12 }} />
            <Text style={{ flex: 1, fontSize: theme.type.label, color: colors.text }}>{item.name}</Text>
            {selected === item.name && <Ionicons name="checkmark" size={18} color={colors.accent} />}
          </Tappable>
        </View>
      ))}

      {filteredOptions.length === 0 && !(normalizedQuery && exactMatch) && (
        <Text style={{ padding: 24, textAlign: 'center', color: colors.textFaint }}>No {type}s found</Text>
      )}
    </ListSheet>
  );
}
