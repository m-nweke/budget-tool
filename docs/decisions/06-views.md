# Story 6: Dashboard, Transactions & Categories Views — Why & Tradeoffs

**What shipped:** `views/Dashboard.vue`, `views/Transactions.vue`, `views/Categories.vue` — where every prior story's pieces (types, api.ts, shared components, date math, dashboard scoping, recurring locking) come together into the actual user-facing screens.

## Why each view owns its own fetch/mutation state (no shared store)

Three views, each with distinct data needs (Dashboard reads aggregated spend; Transactions reads raw rows plus recurring templates; Categories reads categories alone), and no cross-view data dependency that would justify a shared reactive store. Each view calling `api.*` directly in its own `onMounted`/mutation handlers, then re-fetching after every write, is simpler to reason about than introducing Pinia for three independent read/write flows. This is a decision to revisit specifically if a future view needs data another view already fetched — not before.

## Key tradeoff: no optimistic updates

Every create/update/delete in all three views calls its API method, then re-fetches (`await load()`) rather than patching local component state to match the expected result. This means a brief round-trip delay is visible on every mutation — at this app's scale (a handful of rows, local/same-region hosting) that round trip is imperceptible, and "always show what the server actually has" avoids an entire class of bugs where local optimistic state diverges from what the server actually persisted (e.g., a validation failure the optimistic update didn't anticipate).

## Key tradeoff: locking transactions spawned from an *active* recurring series, client-side too

`Transactions.vue` computes `activeRecurringSeries(t)` and only renders the row's `KebabMenu` when that returns falsy — mirroring the server-side guard from story 4 exactly (`r.active === 1`, not just "has a recurring_transaction_id"). This is deliberate duplication, not an oversight: the server enforces the real rule (a client-side-only lock could be bypassed by calling the API directly), but hiding the now-meaningless Edit/Delete buttons client-side is what actually gives the user correct affordances — showing an Edit button that will always 400 would be confusing UX for no benefit.

## Key tradeoff: auto-selecting the sole category

Both `TransactionForm` and `RecurringForm` auto-select a category if there's exactly one (`categories.length === 1 ? categories[0].id : null`). For the very common one-category-so-far state (true for any brand-new budget), this removes a redundant click on every single transaction entry — a small thing, but one of the "build these in, don't wait for feedback to find them" items from the project's UI-polish checklist.

## Key tradeoff: distinguishing "no data" from "no filter match"

Both the transactions list and the dashboard distinguish "genuinely nothing here yet" (create the first one) from "nothing matches the current filter" (clear the filter) with different copy — collapsing these into one generic empty state loses the more common, more actionable case for a user who filtered by category and got zero results.
