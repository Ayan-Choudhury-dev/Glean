import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/lib/appearance';
import { tapHaptic, toggleHaptic, confirmHaptic } from '@/lib/haptics';

type TappableProps = PressableProps & {
  /** Opt-in feedback. Only for taps that change data, not for navigation. */
  haptic?: boolean;
  /** Which effect: a plain selection, a value flip, or a completed action. */
  hapticStyle?: 'tap' | 'toggle' | 'confirm';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Shared tappable surface. Android gets a bounded Material ripple, iOS gets a
 * pressed-state dim, and both get a spring press-scale. Forwards everything
 * (including className) to the native Pressable — never self-register with
 * cssInterop (see AGENTS.md).
 *
 * IMPORTANT: the `style` handed to Pressable must be a plain value, never a
 * function. NativeWind's css-interop collects the `style` prop and spreads it
 * (`{ ...style }`); spreading a function yields `{}`, which then overwrites the
 * real style — every inline style on the element disappears. Pressed state is
 * therefore tracked here and folded into a plain style array instead.
 *
 * Haptics use `selectionAsync`, not `impactAsync`. On Android that maps to
 * HapticFeedbackConstants.CLOCK_TICK — one crisp tick, the same primitive the
 * system keyboard and Samsung's own controls use. `impactAsync` drives the
 * vibrator for a duration instead, which reads as a buzz rather than a tap.
 */

export const Tappable = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  TappableProps
>(function Tappable({ style, android_ripple, onPressIn, onPressOut, onFocus, onBlur, haptic, hapticStyle = 'tap', ...props }, ref) {
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const resolved =
    typeof style === 'function'
      ? style({ pressed } as PressableStateCallbackType)
      : style;

  // Preserve any caller transform; append our scale so we never clobber it.
  const callerTransform = (StyleSheet.flatten(resolved) ?? {}).transform;
  const transform = Array.isArray(callerTransform) ? [...callerTransform, { scale }] : [{ scale }];

  const merged: StyleProp<ViewStyle> = [
    resolved,
    Platform.OS === 'android' ? { overflow: 'hidden' } : null,
    Platform.OS === 'ios' && pressed ? { opacity: 0.65 } : null,
    // Visible focus ring for keyboard / switch-control navigation.
    focused ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.accent, outlineOffset: 2 } : null,
    { transform },
  ];

  return (
    <AnimatedPressable
      ref={ref}
      android_ripple={
        Platform.OS === 'android' ? android_ripple ?? { color: colors.pressed, foreground: true } : android_ripple
      }
      style={merged}
      onPressIn={event => {
        if (haptic) {
          if (hapticStyle === 'confirm') confirmHaptic();
          else if (hapticStyle === 'toggle') toggleHaptic();
          else tapHaptic();
        }
        setPressed(true);
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
        onPressIn?.(event);
      }}
      onPressOut={event => {
        setPressed(false);
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
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
