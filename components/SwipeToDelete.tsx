import React, { useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Tappable } from './ui/tappable';
import { Text } from './ui/text';
import { theme } from '@/constants/theme';

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
            backgroundColor: theme.colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.colors.surface} />
          <Text style={{ color: theme.colors.surface, fontSize: 12, fontWeight: '600' }}>{label}</Text>
        </Tappable>
      )}
    >
      {children}
    </Swipeable>
  );
}
