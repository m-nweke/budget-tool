# Story 5: Client Scaffold, Shared API Layer & Components — Why & Tradeoffs

**What shipped:** Vite + Vue 3 + TS scaffold, `types/` mirroring the server's domain split, `api.ts`, `utils/currency.ts` and `utils/usage.ts`, and the shared components (`KebabMenu.vue`, `CategoryForm.vue`, `TransactionForm.vue`, `RecurringForm.vue`, `NavBar.vue`).

## Why client types are a separate, hand-written mirror of server types (not shared/imported)

**Tradeoff considered:** a monorepo could share a single `types/` package between client and server, avoiding duplication.

**Decision made instead:** duplicate but mirror the shape 1:1, domain folder for domain folder. For a project this size, a shared-package setup (workspace config, build ordering, publish-or-symlink strategy) is infrastructure that outweighs its benefit — the type duplication is small (a handful of interfaces) and the domain-folder mirroring means a change to `server/src/types/category/Category.ts` has an obvious corresponding file to update on the client, rather than a magic auto-sync that could silently drift if it ever broke.

## Why one `request<T>()` wrapper instead of calling `fetch` per view

```ts
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: {...} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

Every mutation in this app can fail with a 400 from the server's validation (bad interval, missing field, blocked delete) — and the *server's* error message (`err.message` from `HttpError`) is the useful, specific one to show the user, not a generic "request failed." Centralizing the non-2xx → `throw new Error(server-message)` logic in one place means every view's `catch (e) { error.value = (e as Error).message }` automatically surfaces the real reason, without each view re-implementing response-status checking.

The `204 No Content` special case matters because `res.json()` throws on an empty body — DELETE endpoints return 204, and without this check every delete call would throw a confusing JSON-parse error immediately after succeeding.

## Why a slot-based `KebabMenu` instead of copy-pasting Edit/Delete buttons

Three views (Categories, Transactions, Recurring) all need per-row actions, and the actions differ per view (Categories: Edit/Delete; Recurring: Edit/Cancel; Transactions: sometimes no actions at all when locked). A slot-based component separates "how do I open/close/position this menu" (built once) from "what buttons does this particular row need" (supplied per call site) — the alternative, three independent open/close implementations, is exactly the "N places need the same fix N times" trap the scaffold skill calls out.

## Why forms take a nullable prop instead of being separate Create/Edit components

`CategoryForm`'s `category: Category | null` prop is the single source of truth for create-vs-edit mode. The form emits only a `submit` event with the payload — it never decides POST vs. PUT itself; the parent view does, based on whether it's currently in edit mode. This keeps the form component ignorant of HTTP verbs entirely, so the same component serves both flows without an `isEditMode` boolean duplicating what the prop's nullability already expresses.
