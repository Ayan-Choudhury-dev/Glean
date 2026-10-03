import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';

type ITextProps = TextProps & { className?: string };

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, ITextProps>(
  function Text({ className, ...props }, ref) {
    return <RNText ref={ref} className={className} {...props} />;
  }
);

Text.displayName = 'Text';

export { Text };
