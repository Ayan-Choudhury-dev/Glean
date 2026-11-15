import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { Text } from './ui/text';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import type { StockPoint } from '@/lib/stockHistory';

/**
 * Stock over the last few weeks, drawn from the consumption log.
 *
 * Deliberately quiet: a line, a faint baseline at zero, and one sentence. It
 * exists to explain the restock suggestion, not to be a dashboard.
 */
export function StockSparkline({
  series,
  usage,
  height = 44,
}: {
  series: StockPoint[];
  usage: string | null;
  height?: number;
}) {
  const colors = useColors();
  if (series.length < 2) return null;

  const width = 100;
  const max = Math.max(...series.map(point => point.qty), 1);
  const span = Math.max(series[series.length - 1].t - series[0].t, 1);

  const x = (t: number) => ((t - series[0].t) / span) * width;
  const y = (qty: number) => height - (qty / max) * (height - 6) - 3;

  const d = series
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.t).toFixed(2)} ${y(point.qty).toFixed(2)}`)
    .join(' ');

  const last = series[series.length - 1];

  return (
    <View style={{ marginTop: 8, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: theme.type.caption, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Last 30 days
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: theme.type.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
          {usage ?? 'no usage yet'}
        </Text>
      </View>

      <View style={{ height, borderRadius: theme.radii.sm, overflow: 'hidden' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke={colors.borderLight} strokeWidth="0.5" />
          <Path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={colors.accentSoft} stroke="none" />
          <Path d={d} fill="none" stroke={colors.accent} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: theme.type.caption, color: colors.textFaint }}>4 weeks ago</Text>
        <Text style={{ fontSize: theme.type.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] }}>
          {last.qty} now
        </Text>
      </View>
    </View>
  );
}
