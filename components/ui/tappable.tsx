import React from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * Shared tappable surface. Android gets a bounded Material ripple, iOS gets a
 * pressed-state dim. Forwards everything (including className) to the native
 * Pressable — never self-register with cssInterop (see AGENTS.md).
 */
const androidRipple = { color: '#0F172A18', foreground: true } as const;

export const Tappable = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  PressableProps
>(function Tappable({ style, android_ripple, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      android_ripple={
        Platform.OS === 'android' ? android_ripple ?? androidRipple : android_ripple
      }
      style={(state: PressableStateCallbackType): StyleProp<ViewStyle> => {
        const resolved = typeof style === 'function' ? style(state) : style;
        const extras: StyleProp<ViewStyle>[] = [];
        if (Platform.OS === 'android') extras.push({ overflow: 'hidden' });
        if (Platform.OS === 'ios' && state.pressed) extras.push({ opacity: 0.65 });
        return extras.length ? [resolved, ...extras] : resolved;
      }}
      {...props}
    />
  );
});

Tappable.displayName = 'Tappable';
