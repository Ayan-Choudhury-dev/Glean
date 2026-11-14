import React, { forwardRef, useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui/text';
import { Tappable } from './ui/tappable';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

/**
 * A sheet with a long list in it.
 *
 * Unlike the hand-rolled `NativeSheet`, the drag and the inner scroll are
 * coordinated by the gesture handler on the UI thread: the sheet follows the
 * finger the moment the list reaches the top, in the same gesture, with no JS
 * round trip. That hand-off is the thing the JS version could not do reliably.
 *
 * Usage: keep a ref, call `present()` / `dismiss()`.
 */
export type ListSheetHandle = {
  present: () => void;
  dismiss: () => void;
};

export const ListSheet = forwardRef<
  ListSheetHandle,
  { title: string; children: React.ReactNode; footer?: React.ReactNode }
>(function ListSheet({ title, children, footer }, ref) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);

  const snapPoints = useMemo(() => ['92%'], []);

  React.useImperativeHandle(ref, () => ({
    present: () => modalRef.current?.present(),
    dismiss: () => modalRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong, width: 40 }}
      backgroundStyle={{ backgroundColor: colors.surface }}
      // The list owns the scroll; the sheet takes over when it is at the top.
      enableContentPanningGesture
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ flex: 1, fontSize: theme.type.lg, fontWeight: '600', color: colors.text }}>{title}</Text>
        <Tappable
          onPress={() => modalRef.current?.dismiss()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Tappable>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: (footer ? 96 : 24) + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </BottomSheetScrollView>

      {footer}
    </BottomSheetModal>
  );
});
