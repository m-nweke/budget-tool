# Story 2: Repository Layer & Date Math — Why & Tradeoffs

**What shipped:** `categoryRepository.ts`, `transactionRepository.ts`, `recurringTransactionRepository.ts`, and `utils/dateMath.ts` with its test suite.

## Why repositories before routes

Routes are thin by design (validate → call repository → respond) — see the root `DECISIONS.md` for the general rationale. Building repositories first meant the recurring-generation engine (story 3) and the route layer (story 4) both had a stable, tested data-access surface to build against, instead of routes and SQL evolving together and making it unclear which layer a bug lived in.

## Key tradeoff: two separate delete-guard queries, not one

`categoryRepository` exposes `countTransactionsForCategory` and `countRecurringForCategory` as two distinct functions rather than one combined "is this category referenced anywhere" check. This is slightly more code, but it means the route layer's guard is explicit about *why* a delete is blocked — "still has transactions" vs. "still has recurring templates" — and a cancelled-but-still-referenced recurring template can't be silently missed by an incomplete join. The spec explicitly calls this out as a failure mode to guard against: a category referenced only by a *cancelled* recurring template must still block deletion, and the two-query approach makes that impossible to skip by accident.

## Key tradeoff: date math as pure functions, tested exhaustively, in UTC

`advanceDate`, `monthCount`, `monthStart`, `monthEnd`, `isValidMonth` all operate on `YYYY-MM-DD` / `YYYY-MM` strings using UTC date methods exclusively (`getUTCFullYear`, `setUTCDate`, etc.), never local-time methods (`getFullYear`, `getDate`).

This was **not** the original implementation — the first pass used local-time methods in `todayString()` and `currentMonth()` while `advanceDate()` already used UTC. That mismatch caused a real, caught-in-testing bug: freezing system time at `2026-02-01T00:00:00Z` in a test and running in a UTC-negative-offset environment made `todayString()` report `2026-01-31`, one day behind what `advanceDate()` was reasoning about — so a recurring-transaction rebuild silently generated one fewer occurrence than expected. The fix was making every date-producing function in the codebase agree on UTC as the single frame of reference. This is exactly the class of bug the spec warns about: "the exact place a subtle off-by-one silently mis-bills someone" — and it was caught by the test suite before it ever reached a route.

## Why no coverage percentage gate was treated as "skip testing"

The spec explicitly says "no blanket coverage percentage target" — but date/time math is called out as the highest-priority thing to test *exhaustively* regardless. `dateMath.test.ts` covers leap years, non-leap Februaries, year-boundary rollovers, and short-month clamping (Jan 31 + 1 month → Mar 3, not an invalid "Feb 31") specifically because these are the inputs most likely to be missed by hand-testing a happy path.
