import React from 'react';
import { View, type ViewProps } from 'react-native';

const SPACE_CLASSES = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-5',
};

type IHStackProps = ViewProps & {
  className?: string;
  space?: keyof typeof SPACE_CLASSES | (string & {});
  reversed?: boolean;
};

const HStack = React.forwardRef<React.ComponentRef<typeof View>, IHStackProps>(
  function HStack({ className, space, reversed, ...props }, ref) {
    const classes = [
      'flex-row',
      space && space in SPACE_CLASSES ? SPACE_CLASSES[space as keyof typeof SPACE_CLASSES] : '',
      reversed ? 'flex-row-reverse' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return <View ref={ref} className={classes} {...props} />;
  }
);

HStack.displayName = 'HStack';

export { HStack };
