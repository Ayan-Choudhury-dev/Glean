import React, { type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, type DimensionValue } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

// @expo/ui ships no native code for Expo Go. Importing it there throws at module
// load, so require it lazily and only in a dev/standalone build.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let NativeBottomSheet: React.ComponentType<{
  index: number;
  onClose: () => void;
  snapPoints?: (string | number)[];
  enablePanDownToClose?: boolean;
  backgroundStyle?: object;
  children: ReactNode;
}> | null = null;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    NativeBottomSheet = require('@expo/ui/community/bottom-sheet').BottomSheet;
  } catch {
    NativeBottomSheet = null;
  }
}

export function NativeSheet({
  visible,
  onClose,
  children,
  snapPoints,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  snapPoints?: (string | number)[];
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Fallback path only: fade the backdrop and translate the sheet in, keeping the
  // modal mounted through the exit animation.
  const anim = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, anim]);

  if (!NativeBottomSheet) {
    if (!mounted) return null;
    // Give the sheet a definite height when the caller asked for one (e.g. '90%'),
    // otherwise let it size to its content.
    const firstSnap = snapPoints?.[0];
    const height: DimensionValue | undefined =
      typeof firstSnap === 'number'
        ? firstSnap
        : typeof firstSnap === 'string' && firstSnap.trim().endsWith('%')
          ? (firstSnap.trim() as DimensionValue)
          : undefined;
    return (
      <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: anim }]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet" />
          <Animated.View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              height,
              maxHeight: '92%',
              paddingBottom: insets.bottom,
              overflow: 'hidden',
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }],
            }}
          >
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 2 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            {children}
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <NativeBottomSheet
      index={visible ? 0 : -1}
      onClose={onClose}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface }}
    >
      {children}
    </NativeBottomSheet>
  );
}
