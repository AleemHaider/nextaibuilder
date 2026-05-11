// Shared TanStack Query configuration — staleTime tiers + queryKey convention.
//
// Why this file exists
// --------------------
// The audit (P2) flagged ~12 inline `staleTime` magic numbers (20_000, 30_000,
// 60_000, 5 * 60_000) sprinkled across hooks and pages. Reviewers couldn't
// tell whether a page was opting into a special policy or whether the author
// just picked a number. Centralising the tiers makes intent explicit and lets
// us tune the whole app from one place if the cache strategy needs to shift.
//
// staleTime tiers
// ---------------
// Pick the tier closest to how long stale data is *acceptable to the user*,
// not how often the data actually changes server-side. A list that mutates
// every second but where 30s-old data still feels fresh = `medium`, not
// `realtime`.

export const STALE_TIME = {
  /** Always refetch on mount/window-focus. Use for live counters, presence,
   *  active-coach views, anything the user expects to update without action. */
  realtime: 0,

  /** ~20s. High-churn polled data (notifications dropdown, screenshot review
   *  queue) where the user expects near-live updates but small lag is fine. */
  short: 20_000,

  /** ~30s. Default for admin list pages (payments, students, modules,
   *  enrollments). Users typically scan → drill in → return; 30s keeps the
   *  back-navigation from re-fetching aggressively while still feeling fresh. */
  medium: 30_000,

  /** ~60s. Course shell / sub-admin / cohort lists. Pages users open, read,
   *  and leave; data churn is low and a stale read is harmless. */
  long: 60_000,

  /** 5 minutes. The QueryClient global default — applied when no per-query
   *  override is set. Suitable for static-ish content (catalog, settings,
   *  profile shells). Keep this in sync with `main.tsx`. */
  session: 5 * 60_000,
} as const

export type StaleTimeTier = keyof typeof STALE_TIME

// queryKey convention
// -------------------
// Use a top-level scope segment (`'admin'`, `'student'`, or a feature name
// when neither applies). Drill down by entity, then by filter args:
//
//   ['admin', 'manual-payments', activeTab, page]
//   ['student', 'notifications']
//   ['admin', 'analytics', 'revenue', dateRange]
//
// Why scoping matters: it gives invalidation a clean prefix. Calling
// `queryClient.invalidateQueries({ queryKey: ['admin', 'manual-payments'] })`
// drops every tab/page combination at once, which is what callers usually
// want after a mutation.
//
// Anti-patterns to avoid:
//   ❌ ['cohorts']                 — no scope, collides with admin/student
//   ❌ ['admin-payments', page]    — kebab-segment merges entity+scope
//   ❌ ['admin', { tab, page }]    — object segments break ordering hashing
//
// New code should follow this shape; legacy `['cohorts']` / `['sub-admins']`
// keys can be migrated opportunistically. The convention is documented here
// rather than enforced via a typed factory because too many pages compose
// dynamic keys (date ranges, filter objects) for a single factory to cover
// without becoming a leaky abstraction.
