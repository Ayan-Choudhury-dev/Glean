import React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { fontForWeight } from '@/constants/theme';

type ITextProps = TextProps & { className?: string };

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, ITextProps>(
  function Text({ className, style, ...props }, ref) {
    const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
    const family = flat.fontFamily ?? fontForWeight(flat.fontWeight);
    // Drop fontWeight — with a custom family it makes iOS fall back to the system font.
    const { fontWeight: _fontWeight, ...rest } = flat;
    return <RNText ref={ref} className={className} style={[rest, { fontFamily: family }]} {...props} />;
  }
);

Text.displayName = 'Text';

export { Text };
