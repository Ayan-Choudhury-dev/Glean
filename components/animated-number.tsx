import React from 'react';
import { type TextProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

/**
 * A number that gives a quick spring "pop" when its value changes — snappy
 * feedback for +/- steppers without being a flourish. Runs on Reanimated's UI
 * thread so it stays responsive while the JS thread is busy.
 */
export function AnimatedNumber({ value, style, ...rest }: { value: number } & TextProps) {
  const scale = useSharedValue(1);
  const prev = React.useRef(value);

  React.useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      scale.value = 0.6;
      scale.value = withSpring(1, { damping: 14, stiffness: 320, mass: 0.5 });
    }
  }, [value, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.Text style={[style, animatedStyle]} {...rest}>
      {value}
    </Animated.Text>
  );
}
