import { describe, expect, it } from 'vitest';

import type { ConsumptionLog } from '../store/useGleanStore';
import {
  estimateDaysUntilFinish,
  formatFinishLabel,
  getRestockSuggestions,
  SURFACE_THRESHOLD_DAYS,
  type PredictionItem,
} from './predictions';

const NOW = new Date('2026-06-01T12:00:00.000Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

let seq = 0;
function log(overrides: Partial<ConsumptionLog> & Pick<ConsumptionLog, 'inventory_id'>): ConsumptionLog {
  seq += 1;
  return {
    id: `log-${seq}`,
    item_name: 'item',
    house_id: 'house',
    consumed_at: daysAgo(0),
    qty: 1,
    action: 'used',
    ...overrides,
  };
}

function item(overrides: Partial<PredictionItem> & Pick<PredictionItem, 'id' | 'name'>): PredictionItem {
  return { qty: 1, category: 'Other', ...overrides };
}

describe('estimateDaysUntilFinish', () => {
  it('returns 0 for out-of-stock items', () => {
    expect(estimateDaysUntilFinish(item({ id: 'a', name: 'A', qty: 0 }), [], NOW)).toBe(0);
  });

  it('uses average daily consumption from use history', () => {
    const logs = [
      log({ inventory_id: 'a', qty: 2, consumed_at: daysAgo(6) }),
      log({ inventory_id: 'a', qty: 2, consumed_at: daysAgo(4) }),
      log({ inventory_id: 'a', qty: 2, consumed_at: daysAgo(0) }),
    ];
    // 6 units over 6 days => 1/day; qty 3 => 3 days.
    expect(estimateDaysUntilFinish(item({ id: 'a', name: 'A', qty: 3 }), logs, NOW)).toBeCloseTo(3, 5);
  });

  it('falls back to a perishable rate of 1/day', () => {
    const it = item({ id: 'd', name: 'Milk', qty: 2, category: 'Dairy' });
    expect(estimateDaysUntilFinish(it, [], NOW)).toBeCloseTo(2, 5);
  });

  it('falls back to a staple rate of 1/3 per day', () => {
    const it = item({ id: 'g', name: 'Rice', qty: 1, category: 'Grains' });
    expect(estimateDaysUntilFinish(it, [], NOW)).toBeCloseTo(3, 5);
  });

  it('clamps long-lived items whose last restock is stale', () => {
    const it = item({
      id: 'g',
      name: 'Flour',
      qty: 100,
      category: 'Grains',
      last_restocked: daysAgo(30),
    });
    expect(estimateDaysUntilFinish(it, [], NOW)).toBe(SURFACE_THRESHOLD_DAYS);
  });
});

describe('formatFinishLabel', () => {
  it('maps day offsets to copy', () => {
    expect(formatFinishLabel(0.4)).toBe('today');
    expect(formatFinishLabel(1.5)).toBe('tomorrow');
    expect(formatFinishLabel(2.1)).toBe('in 3 days');
  });
});

describe('getRestockSuggestions', () => {
  const inventory: PredictionItem[] = [
    item({ id: 'a', name: 'Milk', qty: 2, category: 'Dairy' }), // 2 days
    item({ id: 'b', name: 'Rice', qty: 1, category: 'Grains' }), // 3 days
    item({ id: 'c', name: 'Flour', qty: 10, category: 'Grains' }), // 30 days
    item({ id: 'd', name: 'Spinach', qty: 1, category: 'Vegetables' }), // 1 day, queued by name
    item({ id: 'e', name: 'Cheese', qty: 1, category: 'Dairy' }), // 1 day, queued by id
  ];
  const queued = [
    { name: 'spinach' },
    { name: 'Cheese', inventory_id: 'e' },
  ];

  it('surfaces only within-threshold, non-queued items, soonest first', () => {
    const result = getRestockSuggestions(inventory, [], queued, NOW);
    expect(result.map(s => s.name)).toEqual(['Milk', 'Rice']);
    expect(result[0]).toMatchObject({ itemId: 'a', daysUntilFinish: 2, label: 'in 2 days' });
  });

  it('excludes queued items and out-of-stock items', () => {
    const result = getRestockSuggestions(
      [...inventory, item({ id: 'z', name: 'Eggs', qty: 0, category: 'Dairy' })],
      [],
      queued,
      NOW,
    );
    expect(result.map(s => s.name)).not.toContain('Eggs');
    expect(result.map(s => s.name)).not.toContain('Spinach');
    expect(result.map(s => s.name)).not.toContain('Cheese');
  });
});
