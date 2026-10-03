import React from 'react';
import { View, type ViewProps } from 'react-native';

type ICardProps = ViewProps & { className?: string };

const Card = React.forwardRef<React.ComponentRef<typeof View>, ICardProps>(
  function Card({ className, ...props }, ref) {
    return <View ref={ref} className={className} {...props} />;
  }
);

Card.displayName = 'Card';

export { Card };
