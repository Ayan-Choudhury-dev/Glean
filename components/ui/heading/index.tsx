import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { fonts } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
const SIZE_CLASSES: Record<string, string> = {
  '5xl': 'text-6xl',
  '4xl': 'text-5xl',
  '3xl': 'text-4xl',
  '2xl': 'text-3xl',
  'xl':  'text-2xl',
  'lg':  'text-xl',
  'md':  'text-lg',
  'sm':  'text-base',
  'xs':  'text-sm',
};

type IHeadingProps = TextProps & {
  className?: string;
  size?: keyof typeof SIZE_CLASSES | (string & {});
};

const Heading = React.forwardRef<React.ComponentRef<typeof RNText>, IHeadingProps>(
  function Heading({ className, size = 'lg', style, ...props }, ref) {
    const colors = useColors();
    const sizeClass = size ? SIZE_CLASSES[size] : '';
    const classes = [sizeClass, className].filter(Boolean).join(' ');
    return (
      <RNText ref={ref} accessibilityRole="header" className={classes} style={[{ fontFamily: fonts.displayBold, color: colors.text }, style]} {...props} />
    );
  }
);

Heading.displayName = 'Heading';

export { Heading };
