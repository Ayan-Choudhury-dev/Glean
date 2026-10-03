import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, layout } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

/**
 * Collapsing large-title header (iOS style).
 *
 * Usage: create the shared scroll driver with `useCollapsibleHeader()`, pass its
 * `onScroll` to the list, render `<CollapsibleHeaderBar />` as an absolute overlay,
 * and put `<LargeTitle />` as the first child inside the scrolling content.
 */
export function useCollapsibleHeader() {
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );
  return { scrollY, onScroll };
}

export function CollapsibleHeaderBar({
  title,
  scrollY,
  right,
}: {
  title: string;
  scrollY: Animated.Value;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const bgOpacity = scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });
  const borderOpacity = scrollY.interpolate({ inputRange: [0, 8], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { height: insets.top + layout.compactHeaderHeight, paddingTop: insets.top }]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: bgOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.border, { opacity: borderOpacity, backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <Animated.Text numberOfLines={1} pointerEvents="none" style={[styles.compactTitle, { opacity: bgOpacity, color: colors.text }]}>
          {title}
        </Animated.Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
    </View>
  );
}

export function LargeTitle({ title, scrollY }: { title: string; scrollY: Animated.Value }) {
  const colors = useColors();
  const scale = scrollY.interpolate({ inputRange: [-60, 0], outputRange: [1.08, 1], extrapolate: 'clamp' });
  return (
    <Animated.Text style={[styles.largeTitle, { transform: [{ scale }], color: colors.text, fontFamily: theme.fonts.displayBold }]}>{title}</Animated.Text>
  );
}

/** Top padding a list needs so its first row clears the overlay bar. */
export function useHeaderContentInset() {
  const insets = useSafeAreaInsets();
  return insets.top + layout.compactHeaderHeight;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  border: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  compactTitle: {
    fontSize: theme.type.title,
    fontWeight: '600',
    color: theme.colors.text,
    maxWidth: '70%',
  },
  largeTitle: {
    fontSize: theme.type.display,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: theme.colors.text,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 8,
  },
});
