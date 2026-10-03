import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import type { ReactNode } from 'react';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

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
  return (
    <BottomSheet
      index={visible ? 0 : -1}
      onClose={onClose}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface }}
    >
      {children}
    </BottomSheet>
  );
}
