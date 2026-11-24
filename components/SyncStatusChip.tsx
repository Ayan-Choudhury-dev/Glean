import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from './ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { useOnline } from '@/lib/netStatus';
import { useGleanStore } from '@/store/useGleanStore';

/**
 * One quiet line that says how much to trust the numbers on this screen.
 *
 * Hidden when there is no server (local data cannot be stale). Amber when the
 * phone is offline, red when the last sync failed, muted when everything is
 * current. It exists because a confident wrong number is worse than no number.
 */

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SyncStatusChip() {
  const colors = useColors();
  const online = useOnline();
  const lastSyncedAt = useGleanStore(s => s.lastSyncedAt);
  const syncError = useGleanStore(s => s.syncError);
  const hasServer = useGleanStore(s => s.serverConfigured);

  if (!hasServer) return null;

  if (!online) {
    return (
      <Chip dot={colors.warning} label="Offline · may be out of date" />
    );
  }
  if (syncError) {
    return <Chip dot={colors.danger} label="Sync failed · changes are saved here" />;
  }
  if (lastSyncedAt) {
    return <Chip dot={colors.successBright} label={`Synced ${timeAgo(lastSyncedAt)}`} />;
  }
  return <Chip dot={colors.successBright} label="Connected" />;
}

function Chip({ dot, label }: { dot: string; label: string }) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 32,
        paddingHorizontal: 10,
        borderRadius: theme.radii.pill,
        backgroundColor: colors.surfaceMuted,
        alignSelf: 'flex-start',
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
      <Text style={{ fontSize: theme.type.caption, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}
