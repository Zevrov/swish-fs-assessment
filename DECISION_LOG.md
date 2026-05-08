# Decision Log

This is the document the brief asked for: a walk-through of what I built,
the architectural calls worth flagging, things I considered and dropped,
and where AI tools helped or didn't.

## What I built

All three primary tasks plus all three secondary tasks. The brief asks for
one or two of the secondary items; I did all three because they were small
and adjacent to code I had already touched, and each surfaces something I
wanted to be able to discuss. There's also a bonus stat-type tab strip
above the table.

### Primary

1. **Market Statistics component** — `client/src/components/MarketStatistics.tsx`.
   Cards for total / suspended / released / manual-overrides, computed
   with `useMemo` from the same `markets` array the table renders, so the
   counts always match what the user is looking at. The em-dash placeholder
   only shows on the very first load — during refetches the previous numbers
   stay visible. (More on that decision below; it ties into the scroll
   behavior.)

2. **Manual Suspension API** — `PUT /api/markets/:id/suspension`. Validates
   that the id is a positive integer (strict regex, not the lazy
   `parseInt` that would silently accept `5abc` as `5`), bounded against
   `2_147_483_647` (MySQL `INT` max), `suspended` body must be exactly
   `true | false | null`. Maps to `1 / 0 / NULL` for
   `markets.manual_suspension`. 404 when no rows are affected. On success
   the response includes the freshly-computed enriched market in `data`
   so the client doesn't have to guess what the new state should be.

3. **Player / Team search** — `<input type="search">` in `MarketFilters`
   with a 300 ms debounce. Local input state updates instantly so typing
   feels responsive; the upstream `filters` state (and the fetch) only
   updates after the user pauses. Server-side, the `LIKE` already covered
   `p.name` and `p.team_nickname`; I extended it to `p.team_abbr` so
   "LAL" matches the Lakers.

### Secondary

4. **SQL performance** — replaced the N+1 pattern (one query per market
   for low/high lines, another for the suspension check) with a single
   SQL statement in `marketService.ts`. Two pre-aggregated subqueries
   supply the alternates range and the optimal-line max-odds; the
   `is_suspended` flag is computed in the database via a `CASE`
   expression. The suspension-status filter, which used to run in
   JavaScript over the full result set, now filters on the computed
   column via an outer `SELECT … WHERE is_suspended = ?`. SELECTs per
   request dropped from ~233 → 2.

5. **Suspension logic bug** — the rule says "all probabilities ≤ 40% →
   suspend", but the original code did `some(p => p >= 0.4)` to decide
   *active*. A market with all three odds at exactly 0.4 satisfied "all
   ≤ 40%" but was being marked active. The new SQL uses `max_odds > 0.4`
   (strict), which matches the rule.

6. **Race condition on rapid toggles** — `useMarkets` keeps a `Set` of
   market ids with an in-flight suspension write. Subsequent clicks on
   the same row are dropped while the request is still pending; the
   button is disabled and shows "Updating…" so the user can see why. I
   also added a monotonic `fetchSeqRef` so an out-of-order fetch response
   can't overwrite a newer one when filters change quickly.

### Bonus

7. **Stat-type tab navigation** — `MarketTabs` component above the table:
   `All / Points / Assists / Rebounds / Steals`. Clicking a tab sets
   `filters.statType`, so the existing query path drives table, stats
   cards, and count without extra plumbing. The Stat Type dropdown was
   removed from the filter bar to avoid two controls for the same state.
   Lifted the `filterOptions` fetch into a small `useFilterOptions` hook
   so tabs and filters share one round-trip rather than each fetching
   their own.

## Architectural calls worth flagging

### PUT returns the freshly-enriched market

When the user clears a manual override, the post-update `is_suspended`
depends on rules 2 (no optimal alternate) and 3 (all odds ≤ 0.4) — neither
of which the client can compute on its own. Returning the enriched row
from `PUT /:id/suspension` lets the client replace the optimistic value
with the database's truth instead of approximating. This was a real bug
I caught during my own browser tests — pre-fix, clicking "Remove
Override" on a rule-3 market would briefly show "Released" until the
next list refresh, then snap to "Suspended". Wrong, then right, with no
explanation in between.

The route now has *two* DB ops (UPDATE then GET). I wrapped the GET in
its own try/catch so a read failure after a successful UPDATE returns
`{ success: true, data: null, warning: 'please refetch' }` rather than
500. Otherwise the client would roll back an optimistic update that had
actually persisted to the database — which is worse than the original
problem.

### Two pre-aggregated subqueries instead of one JOIN

The naive shape would be a single `LEFT JOIN alternates a_optimal …
LIMIT 1`. That doesn't actually work in MySQL — `LIMIT` inside a join
doesn't apply per-group, so duplicate optimal-line rows in `alternates`
would multiply the result set. The two subqueries (`a_range` for
MIN/MAX of the line range, `a_optimal` for `GREATEST(MAX(under_odds),
MAX(over_odds), MAX(push_odds))` at the optimal line) collapse those
duplicates before the join, so the row count stays equal to `markets`.

### `CASE` precedence in the suspension expression

```
WHEN m.manual_suspension IS NOT NULL THEN m.manual_suspension
WHEN m.market_suspended = 1          THEN 1
WHEN a_optimal.max_odds IS NULL      THEN 1
WHEN a_optimal.max_odds > 0.4        THEN 0
ELSE 1
```

Manual override has to come first because the brief says it always
wins. `market_suspended = 1` next because it's the cheapest auto-rule.
"No optimal alternate" before the odds check because the odds check
references `a_optimal.max_odds`, which is null in that case (and `null
> 0.4` is null in SQL, which is falsy in `CASE`). Put differently: each
`WHEN` is the negation of what came before, so the order encodes a
truth table.

### `pendingTogglesRef` *and* `pendingToggles` state

The race-condition guard needs synchronous gating — a `useState` setter
isn't synchronous, so by the time React re-renders, the second click
has already fired. The ref is consulted at the top of `toggleSuspension`
to drop overlapping clicks instantly. The state is consulted by the
table cell to know whether to disable the button. Both are kept in sync
via a small helper.

### Optimistic update is asymmetric

When *setting* an override, we know the post-update `is_suspended`
exactly: it's whatever the user just chose, because manual values win
the precedence. So we update the row optimistically and the snap is
invisible.

When *clearing* an override, we don't know — rules 2/3 may flip the
status back to suspended. So we leave the row visible as-is and let the
server's response replace it. The button's "Updating…" state covers the
brief gap.

### Stale-fetch guard via monotonic counter

`fetchSeqRef` is incremented at the start of each fetch; the response
handler bails if the counter has moved on. Without this, a slow first
response can clobber a fast second one, leaving the user looking at a
table that doesn't match the filters they applied last.

### Loading state doesn't blank the page

Originally `MarketTable` returned a small "Loading…" `<div>` whenever
`loading` flipped true, even on refetches. The page collapsed from
full-height to a stub, the browser clamped scroll to the new max
(effectively `0`), and the user got snapped to the top whenever they
clicked a tab. Same problem on `MarketStatistics`, which flipped to
em-dashes during refetch. Now the loading screen / placeholder only
shows on the very first load — subsequent refetches keep the previous
content visible for the few ms it takes new data to land. Small change,
visible UX win.

### DECIMAL hydration at the service boundary

`MarketWithDetails.line / low_line / high_line` are typed as `number`,
but mysql2 hands `DECIMAL(5,2)` columns back as strings (`"8.50"`) to
preserve precision. The original service was passing those strings
straight through, so the API contract was a lie. I added a
`RawMarketRow` interface that types the on-the-wire shape honestly and
a `hydrateMarket(row)` helper that runs DECIMAL columns through
`Number()` and the `0/1` `is_suspended` through `Boolean()`. Same
helper is used by both `getFilteredMarkets` and `getMarketById`, so
there's one place to fix if the schema ever changes.

### Server error handling

Three things needed: a malformed JSON body raised a `SyntaxError` from
`express.json()` that fell through to Express's default and sent HTML;
unknown routes returned the default `Cannot GET /...` HTML; nothing
caught body-too-large.

A global error handler middleware now detects `entity.parse.failed` →
400 with `Malformed JSON body`, `entity.too.large` → 413, falls back to
500. A JSON 404 catch-all sits right before it. `express.json({ limit:
'16kb' })` caps body size — the largest legitimate body in this app is
about 30 bytes. Everything stays in the `{success, error}` envelope
shape regardless of how the request fails.

### Client error handling

Wrapped the axios calls in a service module that throws a normalized
`ApiError` with `status / isNetwork / isTimeout` flags so callers can
branch on the failure mode without knowing about axios. Default timeout
of 10 s (default axios is infinite, which means a hung server pegs the
UI). Toggle failures used to be silent — `console.error` only — so the
user couldn't tell a click had failed; now they trigger a toast via a
small `useToasts` hook and an `onTransientError` callback. Filter-options
loads now expose `error + retry` instead of swallowing failures into
empty dropdowns. An `<ErrorBoundary>` at the app root catches uncaught
render-time exceptions so a single bad component can't blank the
screen.

### Strict TypeScript

Both `tsconfig.json`s shipped with `strict: false`. Turned both on,
which flagged the loose result types from mysql2 (`pool.execute`
returning `[any, any]` by default). Replaced those with proper generics:
`pool.execute<RawMarketRow[]>` for SELECTs, `pool.execute<ResultSetHeader>`
for UPDATEs. Same on the client: `params: any` in the API layer became
`params?: Partial<Filters>`.

## Things I considered and decided against

- **Server-side serialization of suspension writes.** The race-condition
  guard is client-side; a second client could still issue overlapping
  writes. The right server-side fix is either an `If-Match`-style
  version column on `markets` or a row-level `SELECT … FOR UPDATE`
  inside a transaction. I chose not to do that — neither is justified
  by the brief's single-tenant shape and adding a version column is a
  schema change with no other consumer benefit.
- **Wrapping the toggle in a queue instead of dropping clicks.** First
  draft of the race fix was a per-market promise queue — every click
  awaited the previous before issuing the next. That changes user
  intent: clicking *Suspend* and then immediately *Remove Override*
  would fire both in order, which isn't what the user meant. Dropping
  overlapping clicks (with a visible disabled state) is more honest.
- **Refetching the row after a successful clear-override.** This was
  the alternative to the "PUT returns enriched market" approach. It
  works but adds a round-trip and would either trigger a list-loading
  flicker or require a new GET-by-id endpoint anyway. Since I needed
  the GET-by-id query for the PUT response, having PUT return the row
  was strictly cheaper.
- **`zod` or another schema-validation library.** Worth it on a larger
  surface; for one PUT body it would have added a dependency without
  buying much. The hand-rolled `=== true || === false || === null`
  check is short and self-documenting, and the route test fixes it in
  place.
- **Pagination.** The single-query architecture makes adding
  `LIMIT/OFFSET` (or keyset on `m.id`) trivial. The dataset is 116 rows
  so I didn't wire it.
- **Splitting `useMarkets` into a smaller `useToggleSuspension(market)`
  hook.** The current hook does three things (fetching, optimistic
  toggling, in-flight tracking). Pulling per-row state out would mean
  the table cell could subscribe only to its own pending state instead
  of every row re-rendering on any change. ~125 lines total today; not
  a blocker, but I'd want this when the table grows.
- **Replacing the hand-rolled debounce with `useDeferredValue` / a
  `useDebouncedValue` hook.** Hand-rolled version is well-commented and
  works; refactor for refactor's sake.
- **Rate limiting.** Real production concern, out of scope.

## Where AI helped, where it didn't

The brief explicitly says AI tools are allowed and that I'd be expected
to walk through everything during the review, including AI output. I
used Claude as a pair-programmer throughout. Specifics:

- **Helped a lot:** scaffolding the React component shells, drafting the
  CSS for the stat cards / tabs / toasts, the boilerplate around
  `useEffect` cleanup for the debounced search, and the test fixtures.
  Mechanical work with low ambiguity, where the time saved by not
  typing it out manually outweighs the proofreading cost.
- **Modified:** the first cut of the SQL refactor used the
  `LEFT JOIN alternates a_optimal … LIMIT 1` pattern I described above.
  I rewrote it as the two-subquery shape after working through the
  duplicate-row case on paper. The model wouldn't have spotted that
  trap on its own.
- **Threw out:** the first race-condition fix (the queue I described
  earlier), and the original optimistic-update approximation for the
  clear-override path — once I caught the inconsistency in my own
  browser testing I rebuilt the server contract instead.
- **Didn't help:** picking the suspension-status filter strategy
  (in-database vs in-memory). The model kept proposing both. That's a
  real engineering call — pay query-complexity cost or transfer/CPU
  cost at scale — and needed a human decision. I kept it in SQL because
  the cost is the same as fetching everything (we already fetch every
  matching row), and pushing it to SQL means filtering and sorting
  happen in one place.
- **Subtle Jest gotcha I hit:** `clearAllMocks` doesn't drop queued
  `mockResolvedValueOnce` implementations, so a tail of unconsumed
  once-mocks from one test bled into the next. Took one failing
  assertion to spot. Switched to `resetAllMocks`.

## Tests

Both packages had Jest configured but unused. I wrote 38 tests across
two layers:

**Server (29 tests)**

- `routes/__tests__/markets.test.ts` — supertest against the real
  Express app with the `MarketService` mocked. Covers every PUT
  validation branch (success, clear-override, bad string, missing
  body, non-numeric id, parseInt-trap id `5abc`, id `0`, negative,
  beyond MySQL `INT` range), 404 on missing market, 500 envelope on
  service throw, the post-UPDATE-read-failure warning path, GET filter
  pass-through, the JSON 404 for unknown routes, and the JSON 400 for
  malformed bodies.
- `services/__tests__/marketService.test.ts` — pool mocked. Asserts the
  SQL string and parameters generated by each filter combination, that
  the `CASE` precedence is the documented order, that the rule-3
  boundary uses **strict** `> 0.4` and explicitly **not** `>= 0.4`,
  that DECIMAL strings hydrate to numbers, that 0/1 hydrates to
  boolean, that `updateManualSuspension` translates `true / false /
  null` to `1 / 0 / null`, and that `affectedRows = 0` returns false
  from the service.

**Client (9 tests)**

- `hooks/__tests__/useMarkets.test.tsx` — initial fetch, the stale-
  fetch guard (slow first response, fast second, slow one must be
  discarded), the race-condition guard (rapid clicks → only one PUT),
  the clear-override fix (server truth replaces optimistic guess), and
  the rollback + toast path on PUT failure.
- `components/__tests__/MarketStatistics.test.tsx` — em-dash placeholder
  appears only on the true initial load (markets empty + loading), real
  numbers stay visible during refetch (the scroll-jump fix depends on
  this), Manual Overrides counts both `1` and `0` overrides (anything
  non-null), partition holds (`suspended + released = total`).

I also kept a scripted curl regression covering 27 cases (every filter
combination, the suspension partition adding up to total, all four
business rules including the rule-3 fix, every PUT validation branch,
override precedence with snap-back, 10 concurrent overlapping writes,
and a SELECTs-per-request count to prove the N+1 fix landed). All
pass.

## What I'd do with more time

- An integration test layer running against a Dockerized MySQL fixture,
  not just mocked pools. Would catch SQL planner regressions the unit
  tests can't see.
- Pagination on `/api/markets`. The query is ready; the API just needs
  `?limit & ?cursor` plumbing.
- Pull the debounce into a small `useDebouncedValue` hook; pull
  `useToggleSuspension(market)` out of `useMarkets` so each row
  subscribes only to its own pending state.
- A `NODE_ENV !== 'production'` guard on the global error handler so
  500 responses can include the underlying message in dev. Today they
  always say `Internal server error`, which is the right thing for prod
  but unhelpful when developing.
- Server-side write serialization (versioned UPDATEs or row-level
  locks) if this ever becomes multi-tenant.
- Forwarding the error-boundary's caught errors to a real telemetry
  destination instead of just `console.error`.
