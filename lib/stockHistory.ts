import type { ConsumptionLog } from '../store/useGleanStore';

/**
 * Stock over time, rebuilt from the consumption log.
 *
 * Nothing new is recorded for this: the log already has every change. Working
 * backwards from today's quantity gives the level at any earlier moment, which
 * is what the sparkline draws.
 */

const DAY_MS = 86_400_000;

export interface StockPoint {
  t: number;
  qty: number;
}

/** How a log entry moved the stock. */
function delta(log: ConsumptionLog): number {
  const qty = Math.abs(log.qty ?? 0);
  return (log.action ?? 'used') === 'used' ? -qty : qty;
}

/**
 * The stock level sampled across the last `days`, oldest first.
 *
 * Returns an empty array when there is nothing to draw: fewer than two events,
 * or no events at all.
 */
export function buildStockSeries(
  currentQty: number,
  logs: ConsumptionLog[],
  now: number = Date.now(),
  days = 30,
): StockPoint[] {
  const windowStart = now - days * DAY_MS;
  const events = logs
    .map(log => ({ t: new Date(log.consumed_at).getTime(), d: delta(log) }))
    .filter(event => Number.isFinite(event.t))
    .sort((a, b) => a.t - b.t);

  if (events.length < 2) return [];

  // Level today, then walk backwards to find where the window starts.
  const totalDelta = events.reduce((sum, event) => sum + event.d, 0);
  let level = Math.max(0, currentQty - totalDelta);

  const series: StockPoint[] = [];
  const start = Math.min(windowStart, events[0].t);
  series.push({ t: start, qty: level });

  for (const event of events) {
    level = Math.max(0, level + event.d);
    if (event.t >= windowStart) series.push({ t: event.t, qty: level });
  }

  // Make sure the line reaches today.
  series.push({ t: now, qty: Math.max(0, currentQty) });
  return series;
}

/** Units consumed per week over the window. Zero when there is no history. */
export function weeklyUsage(
  logs: ConsumptionLog[],
  now: number = Date.now(),
  days = 30,
): number {
  const windowStart = now - days * DAY_MS;
  const used = logs.filter(
    log =>
      (log.action ?? 'used') === 'used' &&
      log.qty > 0 &&
      new Date(log.consumed_at).getTime() >= windowStart,
  );
  if (used.length === 0) return 0;
  const total = used.reduce((sum, log) => sum + log.qty, 0);
  return total / (days / 7);
}

/** "about 2 a week", "about 1 every 3 days", or null when we cannot say. */
export function usageLabel(logs: ConsumptionLog[], now: number = Date.now()): string | null {
  const perWeek = weeklyUsage(logs, now);
  if (perWeek <= 0) return null;

  if (perWeek >= 1) {
    const rounded = perWeek >= 10 ? Math.round(perWeek) : Math.round(perWeek * 10) / 10;
    return `about ${rounded} a week`;
  }

  const everyDays = Math.round(7 / perWeek);
  return `about 1 every ${everyDays} days`;
}
