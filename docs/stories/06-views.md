# Story 6: Dashboard, Transactions & Categories Views — How It Works

## Concept: the `loaded` flag, separate from data-array emptiness

```ts
const loaded = ref(false);
async function load() {
  categories.value = await api.getCategories();
  loaded.value = true;
}
```

```vue
<div v-if="loaded && categories.length === 0" class="empty-state">...</div>
<table v-else-if="loaded">...</table>
```

`!categories.length` is true both *before* the fetch resolves and *after* it resolves to a genuine zero. Without the separate `loaded` boolean, the empty-state message would flash on-screen for every page load, even when data is coming. Gating both the empty-state and the table behind `loaded` means neither renders until the real answer is known.

## Concept: scroll-into-view on every "open a form" action

```ts
async function openEdit(category: Category) {
  editing.value = category;
  showForm.value = true;
  await nextTick();
  formAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

The form renders at the top of the view, but the row whose Edit button was clicked can be far down a long list. `await nextTick()` is necessary because `scrollIntoView` needs the form to already be in the DOM (from `showForm.value = true`) before it can scroll to it — calling it in the same tick as the `ref` flip would scroll to where the anchor *used to be* (or not at all).

## Concept: dashboard month-range guard, client-side

```ts
async function load() {
  if (from.value && to.value && from.value > to.value) {
    error.value = 'From month must be on or before To month.';
    return;
  }
  data.value = await api.getDashboard(from.value || undefined, to.value || undefined);
}
```

`<input type="month">` naturally produces `YYYY-MM` strings, which compare correctly with plain string comparison (`>`) — no date parsing needed. This client-side guard exists specifically so an invalid range never reaches the server at all, rather than relying solely on the server's own `from <= to` validation (story 4) to reject it after a round trip.

## Concept: the Transactions view ties three data sources together

```ts
function activeRecurringSeries(t: Transaction): RecurringTransaction | undefined {
  if (t.recurring_transaction_id === null) return undefined;
  return recurring.value.find((r) => r.id === t.recurring_transaction_id && r.active === 1);
}
```

```vue
<td class="actions-col">
  <KebabMenu v-if="!activeRecurringSeries(t)">
    <button @click="openEditTx(t)">Edit</button>
    <button class="danger" @click="onDeleteTx(t)">Delete</button>
  </KebabMenu>
</td>
```

`categories`, `transactions`, and `recurring` are all fetched together in `load()` via `Promise.all(...)`, because rendering a transaction row correctly requires cross-referencing all three: which category name to show, and whether this row's originating series (if any) is still active. The kebab menu itself is simply omitted (not disabled) for a locked row — matching the "rows spawned from an active recurring series show no direct actions" requirement literally, rather than showing a disabled/greyed-out menu that implies an action almost works.

## Concept: `<table-layout: fixed>` plus an explicit actions-column width

```css
table { table-layout: fixed; }
th.actions-col, td.actions-col { width: 3rem; white-space: normal; }
```

The actions column is empty in most rows (any row locked by an active series) and holds only a small kebab icon otherwise. `table-layout: auto` (the default) sizes columns from content across every row, so a mostly-empty icon column collapses far more than intended even at `width: 100%` on the table. Giving it an explicit fixed width, combined with `table-layout: fixed` on the table itself, keeps the column's width stable regardless of how many rows in the current page happen to be locked.
