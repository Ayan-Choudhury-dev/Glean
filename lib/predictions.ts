import type { ConsumptionLog, InventoryItem, ShoppingItem } from '../store/useGleanStore';

const DAY_MS = 86_400_000;

/** Surface a restock suggestion only when an item is predicted to finish within this window. */
export const SURFACE_THRESHOLD_DAYS = 3;

/** No restock for this long implies the item is nearly done regardless of history. */
const STALE_RESTOCK_DAYS = 21;

const PERISHABLE_CATEGORIES = new Set([
  'Dairy',
  'Vegetables',
  'Fruits',
  'Meat & Fish',
  'Beverages',
]);

/** Per-day consumption fallback when there is not enough history to estimate a rate. */
const PERISHABLE_RATE = 1; // units/day
const STAPLE_RATE = 1 / 3; // units/day

export type PredictionItem = Pick<
  InventoryItem,
  'id' | 'name' | 'qty' | 'category' | 'last_restocked'
>;

export type QueuedItem = Pick<ShoppingItem, 'name'> & { inventory_id?: string };

export interface RestockSuggestion {
  itemId: string;
  name: string;
  daysUntilFinish: number;
  label: string;
}

function usedLogsFor(itemId: string, logs: ConsumptionLog[]): ConsumptionLog[] {
  return logs
    .filter(
      log =>
        log.inventory_id === itemId &&
        (log.action ?? 'used') === 'used' &&
        log.qty > 0,
    )
    .sort(
      (a, b) =>
        new Date(a.consumed_at).getTime() - new Date(b.consumed_at).getTime(),
    );
}

/**
 * Estimate how many days until an item runs out.
 *
 * 1. With ≥2 `used` logs: average daily consumption (total units ÷ span in days).
 * 2. Otherwise fall back to a category rate (perishable 1/day, staple 1/3 per day).
 * 3. If the item has not been restocked in over 21 days, clamp to the surface window.
 */
export function estimateDaysUntilFinish(
  item: PredictionItem,
  logs: ConsumptionLog[],
  now: number = Date.now(),
): number {
  if (item.qty <= 0) return 0;

  const used = usedLogsFor(item.id, logs);
  let rate: number;

  if (used.length >= 2) {
    const first = new Date(used[0].consumed_at).getTime();
    const last = new Date(used[used.length - 1].consumed_at).getTime();
    const spanDays = Math.max((last - first) / DAY_MS, 1);
    const total = used.reduce((sum, log) => sum + log.qty, 0);
    rate = total / spanDays;
  } else {
    rate = PERISHABLE_CATEGORIES.has(item.category)
      ? PERISHABLE_RATE
      : STAPLE_RATE;
  }

  if (!(rate > 0)) rate = STAPLE_RATE;

  let days = item.qty / rate;

  if (item.last_restocked) {
    const sinceRestock = (now - new Date(item.last_restocked).getTime()) / DAY_MS;
    if (sinceRestock > STALE_RESTOCK_DAYS) {
      days = Math.min(days, SURFACE_THRESHOLD_DAYS);
    }
  }

  return days;
}

export function formatFinishLabel(daysUntilFinish: number): string {
  if (daysUntilFinish < 1) return 'today';
  if (daysUntilFinish < 2) return 'tomorrow';
  return `in ${Math.ceil(daysUntilFinish)} days`;
}

export function getRestockSuggestions(
  inventory: PredictionItem[],
  logs: ConsumptionLog[],
  queued: QueuedItem[],
  now: number = Date.now(),
): RestockSuggestion[] {
  const queuedIds = new Set(
    queued.map(q => q.inventory_id).filter((id): id is string => Boolean(id)),
  );
  const queuedNames = new Set(queued.map(q => q.name.toLowerCase()));

  return inventory
    .filter(item => item.qty > 0)
    .filter(
      item =>
        !queuedIds.has(item.id) && !queuedNames.has(item.name.toLowerCase()),
    )
    .map(item => ({
      itemId: item.id,
      name: item.name,
      daysUntilFinish: estimateDaysUntilFinish(item, logs, now),
    }))
    .filter(s => s.daysUntilFinish <= SURFACE_THRESHOLD_DAYS)
    .sort(
      (a, b) =>
        a.daysUntilFinish - b.daysUntilFinish || a.name.localeCompare(b.name),
    )
    .map(s => ({ ...s, label: formatFinishLabel(s.daysUntilFinish) }));
}
