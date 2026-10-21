/**
 * The usage of a depot against the limits of its plan (FR-4). The helpers are pure so they can be
 * tested without a screen, and the numbers stay plain numbers: the API sends the usage as counts
 * and the limits as counts or null for "no limit".
 */

export interface UsageBar {
  /** How much of the limit is used, in percent. Zero when there is no limit. */
  percent: number;
  /** How much is left before the limit is reached. Null when there is no limit. */
  remaining: number | null;
  /** True when the limit is reached and nothing more can be created. */
  reached: boolean;
  /** True when the depot uses more than the limit allows. */
  over: boolean;
  /** True when the plan has no limit for this number. */
  unlimited: boolean;
}

/** The bar of one number of the usage against the limit of the plan. */
export function usageBar(used: number, limit: number | null): UsageBar {
  if (limit === null || limit <= 0) {
    return { percent: 0, remaining: null, reached: false, over: false, unlimited: true };
  }

  const safeUsed = Math.max(0, used);
  const percent = Math.min(100, Math.round((safeUsed / limit) * 100));
  const remaining = Math.max(0, limit - safeUsed);

  return {
    percent,
    remaining,
    reached: safeUsed >= limit,
    over: safeUsed > limit,
    unlimited: false,
  };
}

/** The bar of the users and the bar of the products of a depot. */
export function planUsageBars(
  usage: {
    users: number;
    products: number;
  },
  limits: { users: number | null; products: number | null },
): { users: UsageBar; products: UsageBar } {
  return {
    users: usageBar(usage.users, limits.users),
    products: usageBar(usage.products, limits.products),
  };
}

/** True when the depot cannot create a user or a product anymore. */
export function planLimitReached(bars: { users: UsageBar; products: UsageBar }): boolean {
  return bars.users.reached || bars.products.reached;
}

/** The name of the limit that is reached, or null when nothing is reached. */
export type LimitKind = 'users' | 'products';

export function reachedLimit(bars: { users: UsageBar; products: UsageBar }): LimitKind | null {
  if (bars.users.reached) {
    return 'users';
  }

  if (bars.products.reached) {
    return 'products';
  }

  return null;
}
