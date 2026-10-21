/** Feature flags for work-in-progress surfaces. */
export const FEATURES = {
  /** Restock-suggestions shelf on the shopping list — parked for now. */
  restockSuggestions: false,
  /** Multi-user households (join / invite / members). Off for the solo v1 release. */
  household: false,
} as const;

/** Consumption-log rows fetched per house — bounds memory/egress (previously unbounded). */
export const RECENT_ACTIVITY_FETCH_LIMIT = 200;
/** How many of those the item detail page shows. */
export const RECENT_ACTIVITY_DISPLAY_LIMIT = 8;
