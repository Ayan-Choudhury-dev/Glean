import React, { useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Tappable } from './ui/tappable';
import { Text } from './ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

/** Swipe a row left to reveal a Delete action (tapping it runs `onDelete`). */
export function SwipeToDelete({
  children,
  onDelete,
  label = 'Delete',
}: {
  children: React.ReactNode;
  onDelete: () => void;
  label?: string;
}) {
  const ref = useRef<{ close: () => void } | null>(null);
  const colors = useColors();

  return (
    <Swipeable
      ref={ref as never}
      overshootRight={false}
      renderRightActions={() => (
        <Tappable
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{
            width: 88,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.surface} />
          <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '600' }}>{label}</Text>
        </Tappable>
      )}
    >
      {children}
    </Swipeable>
  );
}
