import React from 'react';
import { Image, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { houseImagePreset } from '@/constants/houseImages';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

/**
 * A house's display image: the preset artwork when supplied, otherwise a tinted
 * tile with its icon. Falls back to the app accent when no image is set.
 */
export function HouseAvatar({
  imageKey,
  size = 48,
  radius,
}: {
  imageKey?: string | null;
  size?: number;
  radius?: number;
}) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const preset = houseImagePreset(imageKey);
  const corner = radius ?? theme.radii.md;
  const [failed, setFailed] = React.useState(false);

  if (preset?.source && !failed) {
    return (
      <Image
        source={preset.source}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: corner, backgroundColor: colors.surfaceSunken }}
      />
    );
  }

  const bg = preset ? (isDark ? preset.tintDark : preset.tint) : colors.accentSoft;
  const fg = preset ? colors.text : colors.accent;

  return (
    <View style={{ width: size, height: size, borderRadius: corner, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={preset?.icon ?? 'home-outline'} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}
