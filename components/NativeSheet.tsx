import React, { type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type GestureResponderHandlers,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

/**
 * Bottom sheet with drag-to-dismiss.
 *
 * Implemented in JS (RN `Modal` + `Animated` + `PanResponder`) rather than
 * `@expo/ui/community/bottom-sheet`: the native Material3 sheet lives in its own
 * Compose window, so an RN list inside it swallows the pan and the sheet can't be
 * dragged to dismiss.
 *
 * Scroll hand-off: the sheet *captures* a downward drag only when the inner list
 * is at the top (tracked via `SheetScrollContext`); otherwise the list scrolls.
 * That's the standard bottom-sheet behaviour — drag the list down at the top and
 * the sheet follows; scroll first and the list moves.
 *
 * NOTE: animations run on the JS driver on purpose — translateY combines the
 * open/close animation with the live drag offset, and RN can't mix drivers.
 */

const CLOSE_DRAG_PX = 110; // past this a drag dismisses
const CLOSE_VELOCITY = 0.6; // …or a quick flick
const HIDDEN_OFFSET = 520; // slide-out distance (sheet is at most ~92% tall)

type SheetCtx = {
  /** Inner list's vertical scroll offset — wire your ScrollView/FlatList `onScroll` to it. */
  scrollY: React.MutableRefObject<number>;
  /** Spread onto a header/title row to make it drag the sheet. */
  panHandlers: GestureResponderHandlers;
};

const SheetContext = React.createContext<SheetCtx | null>(null);

/** Wire an inner ScrollView/FlatList's `onScroll` to this so the sheet can hand off. */
export function useSheetScroll() {
  return React.useContext(SheetContext)?.scrollY ?? null;
}

/** Spread onto a header/title row to make it a drag zone. */
export function useSheetDrag() {
  return React.useContext(SheetContext);
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

  const anim = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dragY = React.useRef(new Animated.Value(0)).current;
  const scrollY = React.useRef(0);
  const [mounted, setMounted] = React.useState(visible);

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, anim, dragY]);

  // Claim a downward drag when the inner list is at the top; otherwise let the
  // list scroll. Capture phase so the sheet wins before the list does.
  //
  // The second clause is the deliberate-pull escape hatch: once a downward drag
  // passes the distance that would close the sheet anyway, take it even if the
  // list is still scrolled. RN re-evaluates capture on every move, so a list
  // that reaches the top mid-gesture hands off on its own; this covers the case
  // where the list is long and the pull starts deep in it.
  const shouldClaim = React.useCallback(
    (_e: unknown, g: { dy: number; dx: number }) => {
      if (g.dy <= 4 || Math.abs(g.dy) <= Math.abs(g.dx)) return false;
      return scrollY.current <= 2 || g.dy > CLOSE_DRAG_PX;
    },
    [],
  );

  const pan = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: shouldClaim,
      // Bubble phase: no scroll guard, so non-scrolling areas (header/title row)
      // still drag even after the inner list has been scrolled.
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > CLOSE_DRAG_PX || g.vy > CLOSE_VELOCITY) {
          onCloseRef.current();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
      },
    })
  ).current;

  // The handle claims on touch-down so it always responds, independent of the
  // capture/move negotiation used for scroll hand-off on the content.
  const handlePan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > CLOSE_DRAG_PX || g.vy > CLOSE_VELOCITY) {
          onCloseRef.current();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
      },
    })
  ).current;

  if (!mounted) return null;

  const firstSnap = snapPoints?.[0];
  const height: DimensionValue | undefined =
    typeof firstSnap === 'number'
      ? firstSnap
      : typeof firstSnap === 'string' && firstSnap.trim().endsWith('%')
        ? (firstSnap.trim() as DimensionValue)
        : undefined;

  const translateY = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [HIDDEN_OFFSET, 0] }),
    dragY,
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: anim }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet" />
        <Animated.View
          {...pan.panHandlers}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            height,
            maxHeight: '94%',
            paddingBottom: insets.bottom,
            overflow: 'hidden',
            transform: [{ translateY }],
          }}
        >
          <SheetContext.Provider value={{ scrollY, panHandlers: pan.panHandlers }}>
            {/* Grab handle — a generous, directly-draggable strip. */}
            <View
              {...handlePan.panHandlers}
              style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 18, paddingBottom: 14 }}
            >
              <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
            </View>
            {children}
          </SheetContext.Provider>
        </Animated.View>
      </View>
    </Modal>
  );
}
