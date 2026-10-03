import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  type PressableProps,
} from 'react-native';
import { Tappable } from '../tappable';

const SIZE_CLASSES = {
  xs: 'px-3.5 h-8',
  sm: 'px-4 h-9',
  md: 'px-5 h-10',
  lg: 'px-6 h-11',
  xl: 'px-7 h-12',
};

const VARIANT_CLASSES = {
  solid: '',
  outline: 'bg-transparent border border-slate-200',
  link: 'bg-transparent px-0',
};

const ACTION_CLASSES = {
  primary: 'bg-slate-900',
  secondary: 'bg-slate-200',
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  default: 'bg-transparent',
};

type IButtonProps = PressableProps & {
  className?: string;
  size?: keyof typeof SIZE_CLASSES | (string & {});
  variant?: keyof typeof VARIANT_CLASSES | (string & {});
  action?: keyof typeof ACTION_CLASSES | (string & {});
};

const classFor = <T extends Record<string, string>>(map: T, key?: string) =>
  key && key in map ? map[key as keyof T] : '';

const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, IButtonProps>(
  function Button(
    { className, size = 'md', variant = 'solid', action = 'primary', disabled, ...props },
    ref
  ) {
    const classes = [
      'flex-row items-center justify-center gap-2 rounded-md',
      classFor(SIZE_CLASSES, size),
      classFor(VARIANT_CLASSES, variant),
      classFor(ACTION_CLASSES, action),
      disabled ? 'opacity-40' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Tappable
        ref={ref}
        className={classes}
        disabled={disabled}
        accessibilityRole="button"
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

type IButtonTextProps = React.ComponentProps<typeof RNText> & {
  className?: string;
};

const ButtonText = React.forwardRef<
  React.ComponentRef<typeof RNText>,
  IButtonTextProps
>(function ButtonText({ className, ...props }, ref) {
  return (
    <RNText
      ref={ref}
      className={['font-semibold text-slate-500', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

ButtonText.displayName = 'ButtonText';

const ButtonSpinner = ActivityIndicator;

export { Button, ButtonText, ButtonSpinner };
