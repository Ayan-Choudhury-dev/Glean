import React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { fontForWeight } from '@/constants/theme';

type ITextProps = TextProps & { className?: string };

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, ITextProps>(
  function Text({ className, style, ...props }, ref) {
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    const family = flat?.fontFamily ?? fontForWeight(flat?.fontWeight);
    return <RNText ref={ref} className={className} style={[{ fontFamily: family }, style]} {...props} />;
  }
);

Text.displayName = 'Text';

export { Text };
