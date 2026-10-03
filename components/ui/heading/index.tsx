import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';

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
  function Heading({ className, size = 'lg', ...props }, ref) {
    const sizeClass = size ? SIZE_CLASSES[size] : '';
    const classes = ['font-bold', sizeClass, className].filter(Boolean).join(' ');
    return (
      <RNText ref={ref} accessibilityRole="header" className={classes} {...props} />
    );
  }
);

Heading.displayName = 'Heading';

export { Heading };
