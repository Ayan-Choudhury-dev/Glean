import React from 'react';
import { Image, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { initialsFor } from '@/lib/initials';
import type { Member } from '@/store/useGleanStore';

/**
 * Overlapping member avatars. Used on the Household card and the join greeting
 * so membership is visible without opening Settings → Members.
 */
export function MemberStack({
  members,
  size = 32,
  max = 5,
}: {
  members: Member[];
  size?: number;
  max?: number;
}) {
  const colors = useColors();
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  const overlap = Math.round(size * 0.3);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <View
          key={m.id}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: i === 0 ? 0 : -overlap,
            borderWidth: 2,
            borderColor: colors.surface,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {m.avatar_url ? (
            <Image source={{ uri: m.avatar_url }} style={{ width: size, height: size }} />
          ) : (
            <Text style={{ color: colors.onAccent, fontSize: Math.round(size * 0.36), fontFamily: theme.fonts.medium }}>
              {initialsFor(m.name)}
            </Text>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: -overlap,
            borderWidth: 2,
            borderColor: colors.surface,
            backgroundColor: colors.chipBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: Math.round(size * 0.34), fontFamily: theme.fonts.medium }}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}
