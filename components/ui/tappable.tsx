import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/lib/appearance';

/**
 * Shared tappable surface. Android gets a bounded Material ripple, iOS gets a
 * pressed-state dim. Forwards everything (including className) to the native
 * Pressable — never self-register with cssInterop (see AGENTS.md).
 *
 * IMPORTANT: the `style` handed to Pressable must be a plain value, never a
 * function. NativeWind's css-interop collects the `style` prop and spreads it
 * (`{ ...style }`); spreading a function yields `{}`, which then overwrites the
 * real style — every inline style on the element disappears. Pressed state is
 * therefore tracked here and folded into a plain style array instead.
 */

export const Tappable = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  PressableProps
>(function Tappable({ style, android_ripple, onPressIn, onPressOut, onFocus, onBlur, ...props }, ref) {
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const colors = useColors();

  const resolved =
    typeof style === 'function'
      ? style({ pressed } as PressableStateCallbackType)
      : style;

  const merged: StyleProp<ViewStyle> = [
    resolved,
    Platform.OS === 'android' ? { overflow: 'hidden' } : null,
    Platform.OS === 'ios' && pressed ? { opacity: 0.65 } : null,
    // Visible focus ring for keyboard / switch-control navigation.
    focused ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.accent, outlineOffset: 2 } : null,
  ];

  return (
    <Pressable
      ref={ref}
      android_ripple={
        Platform.OS === 'android' ? android_ripple ?? { color: colors.pressed, foreground: true } : android_ripple
      }
      style={merged}
      onPressIn={event => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onFocus={event => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={event => {
        setFocused(false);
        onBlur?.(event);
      }}
      {...props}
    />
  );
});

Tappable.displayName = 'Tappable';
