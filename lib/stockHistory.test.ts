import { describe, expect, it } from 'vitest';
import type { ConsumptionLog } from '../store/useGleanStore';
import { buildStockSeries, usageLabel, weeklyUsage } from './stockHistory';

const NOW = new Date('2026-06-01T12:00:00.000Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

let seq = 0;
function log(qty: number, action: ConsumptionLog['action'], day: number): ConsumptionLog {
  seq += 1;
  return {
    id: `l${seq}`,
    inventory_id: 'item',
    item_name: 'Milk',
    house_id: 'house',
    qty,
    action,
    consumed_at: daysAgo(day),
  };
}

describe('buildStockSeries', () => {
  it('returns nothing without at least two events', () => {
    expect(buildStockSeries(3, [log(1, 'used', 1)], NOW)).toEqual([]);
    expect(buildStockSeries(3, [], NOW)).toEqual([]);
  });

  it('walks backwards from today to rebuild the level', () => {
    // Bought 6 three days ago, used 2 since: today there are 4.
    const logs = [log(6, 'restocked', 3), log(2, 'used', 1)];
    const series = buildStockSeries(4, logs, NOW);

    expect(series.length).toBeGreaterThanOrEqual(3);
    expect(series[series.length - 1].qty).toBe(4);
    // Somewhere before the use, the level was higher.
    expect(Math.max(...series.map(p => p.qty))).toBeGreaterThanOrEqual(6);
  });

  it('never goes below zero', () => {
    const logs = [log(5, 'used', 2), log(5, 'used', 1)];
    const series = buildStockSeries(0, logs, NOW);
    expect(series.every(p => p.qty >= 0)).toBe(true);
  });
});

describe('weeklyUsage', () => {
  it('is zero with no history', () => {
    expect(weeklyUsage([], NOW)).toBe(0);
  });

  it('averages the window', () => {
    // 8 units over 28 days = 2 per week.
    const logs = [log(4, 'used', 20), log(4, 'used', 8)];
    expect(weeklyUsage(logs, NOW, 28)).toBeCloseTo(2, 5);
  });

  it('ignores restocks and additions', () => {
    const logs = [log(10, 'restocked', 2), log(10, 'added', 1)];
    expect(weeklyUsage(logs, NOW)).toBe(0);
  });
});

describe('usageLabel', () => {
  it('says nothing without history', () => {
    expect(usageLabel([], NOW)).toBeNull();
  });

  it('reads in weeks when usage is frequent', () => {
    // 12 units over the 30-day window ≈ 2.8 a week.
    const logs = [log(6, 'used', 20), log(6, 'used', 8)];
    expect(usageLabel(logs, NOW)).toBe('about 2.8 a week');
  });

  it('reads in days when usage is rare', () => {
    // 1 unit in 30 days ≈ 0.23/week → about 1 every 30 days.
    const logs = [log(1, 'used', 10), log(1, 'used', 29)];
    expect(usageLabel(logs, NOW)).toContain('every');
  });
});
