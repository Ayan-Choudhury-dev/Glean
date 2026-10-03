import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import type { ReactNode } from 'react';
import { theme } from '@/constants/theme';

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
  return (
    <BottomSheet
      index={visible ? 0 : -1}
      onClose={onClose}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
    >
      {children}
    </BottomSheet>
  );
}
