import React, { useState, useMemo } from 'react';
import { View, SectionList, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGleanStore } from '../../store/useGleanStore';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';

export default function InventoryScreen() {
  const { inventory } = useGleanStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    const cats = new Set(inventory.map(item => item.category));
    return Array.from(cats).sort();
  }, [inventory]);

  const filtered = inventory.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === null ||
      (selectedCategory === 'out-of-stock' ? item.qty === 0 : item.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const sections = useMemo(() => {
    const groups = filtered.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof inventory>);

    return Object.keys(groups)
      .sort()
      .map(category => ({ title: category, data: groups[category] }));
  }, [filtered]);

  return (
    <View className="flex-1 bg-white">

{/* Empty state */}
    {inventory.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Heading size="xl" className="text-gray-400">Add some groceries</Heading>
          <Text className="text-sm text-gray-400 mt-2">Click the button below to add an item</Text>
          <View className="mt-6 gap-3 w-64">
            <Button
              size="md"
              className="bg-slate-900 rounded-xl"
              onPress={() => router.push('/item-form')}
            >
              <ButtonText className="text-white">Add new item</ButtonText>
            </Button>
            <Button
              size="md"
              variant="outline"
              className="rounded-xl border-slate-300"
              onPress={() => {}}
            >
              <ButtonText className="text-slate-700">Add using CSV</ButtonText>
            </Button>
          </View>
        </View>
      ) : (
        <View>
        {/* Page title */}
      <View className="px-6 pt-14 pb-3 w-full flex flex-row justify-between space-between">
        <Heading size="xl" className="text-gray-900">Inventory</Heading>
        <Button
          size="md"
          className="bg-slate-900 rounded-xl"
          onPress={() => router.push('/item-form')}
        >
          <Ionicons name="add" size={18} color="#fff" style={{ marginRight: 0 }} />
          {/* <ButtonText className="text-white"></ButtonText> */}
        </Button>
      </View>

      {/* Search bar */}
      <View className="px-6 pb-3">
        <HStack className="items-center bg-gray-100 border border-gray-200 rounded-xl px-3 h-11">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-2 text-sm text-gray-800"
            placeholder="Search for 'atta'"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </HStack>
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12, gap: 8 }}
      >
        <Pressable
          onPress={() => setSelectedCategory(null)}
          className={`h-8 px-4 rounded-full border justify-center ${
            selectedCategory === null
              ? 'bg-slate-900 border-slate-900'
              : 'bg-white border-gray-200'
          }`}
        >
          <Text className={`text-xs font-medium ${selectedCategory === null ? 'text-white' : 'text-gray-600'}`}>
            All
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedCategory('out-of-stock')}
          className={`h-8 px-4 rounded-full border justify-center ${
            selectedCategory === 'out-of-stock'
              ? 'bg-slate-900 border-slate-900'
              : 'bg-white border-gray-200'
          }`}
        >
          <Text className={`text-xs font-medium ${selectedCategory === 'out-of-stock' ? 'text-white' : 'text-gray-600'}`}>
            Out of stock
          </Text>
        </Pressable>
        {availableCategories.map(cat => (
          <Pressable
            key={cat}
            onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`h-8 px-4 rounded-full border justify-center ${
              selectedCategory === cat
                ? 'bg-slate-900 border-slate-900'
                : 'bg-white border-gray-200'
            }`}
          >
            <Text className={`text-xs font-medium ${selectedCategory === cat ? 'text-white' : 'text-gray-600'}`}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Filtered empty state */}
      {sections.length === 0 && (
        <View className="flex-1 items-center justify-center py-16">
          <Ionicons name="search-outline" size={40} color="#D1D5DB" />
          <Heading size="md" className="text-gray-400 mt-4">No items found</Heading>
          <Text className="text-sm text-gray-400 mt-1">Try a different search or filter</Text>
        </View>
      )}

      {/* Sectioned inventory list */}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderSectionHeader={({ section: { title } }) => (
          <HStack className="items-center gap-3 bg-slate-50 px-6 py-3">
            <Ionicons name="leaf-outline" size={16} color="#10B981" />
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              {title}
            </Text>
          </HStack>
        )}
        renderItem={({ item, index, section }) => (
          <View>
            <Pressable onPress={() => router.push(`/item-form?itemId=${item.id}`)}>
              <HStack className="items-center px-6 py-4">
                <Text className="flex-1 text-sm font-medium text-gray-900">{item.name}</Text>
                {item.qty === 0 ? (
                  <View className="bg-red-100 rounded-full px-2 py-0.5">
                    <Text className="text-xs font-medium text-red-500">Out of stock</Text>
                  </View>
                ) : item.qty === 1 ? (
                  <View className="bg-amber-100 rounded-full px-2 py-0.5">
                    <Text className="text-xs font-medium text-amber-600">Low stock</Text>
                  </View>
                ) : (
                  <Text className="w-8 text-center text-sm text-gray-700">{item.qty}</Text>
                )}
                <Text className="w-32 text-right text-sm text-gray-400" numberOfLines={1}>
                  {item.location ?? '—'}
                </Text>
              </HStack>
            </Pressable>

            {index < section.data.length - 1 && (
              <View className="h-px bg-gray-100 mx-6" />
            )}
          </View>
        )}
      />
        </View>
      )}
    </View>
  );
}
