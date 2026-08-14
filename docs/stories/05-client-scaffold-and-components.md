# Story 5: Client Scaffold, Shared API Layer & Components — How It Works

## Structure

```
client/src/
  types/<domain>/   — mirrors server's domain split
  utils/            — currency.ts, usage.ts (pure, testable-in-principle helpers)
  api.ts            — one typed method per endpoint, through request<T>()
  components/       — KebabMenu, CategoryForm, TransactionForm, RecurringForm, NavBar
```

## Concept: `classifyUsage` — one function driving two visual signals

```ts
export function classifyUsage(spent: number, budgeted: number): UsageTier {
  if (budgeted <= 0) return spent > 0 ? 'red' : 'green';
  const pct = (spent / budgeted) * 100;
  if (pct >= 75) return 'red';
  if (pct >= 50) return 'orange';
  return 'green';
}

export function cappedPercent(spent: number, budgeted: number): number {
  if (budgeted <= 0) return spent > 0 ? 100 : 0;
  return Math.min(100, (spent / budgeted) * 100);
}
```

Both the dashboard's progress-bar fill color and its "remaining/over" text color are class-bound to `classifyUsage(...)` — never two separately-written threshold checks. Note the deliberate split between the two functions: `classifyUsage` uses the **uncapped** percentage (so 150% and 300% both classify as `'red'`, correctly reflecting "very over budget"), while `cappedPercent` clamps the *display width* to 100% (so the bar itself never renders wider than its track). Using the capped value for classification would make 105% and 100% look identically "just barely red" — using the uncapped value for the bar's width would overflow the layout. Two different numbers, two different jobs, same underlying spent/budgeted pair.

## Concept: the form pattern in practice

```vue
<script setup lang="ts">
const props = defineProps<{ category: Category | null }>();
const emit = defineEmits<{ submit: [payload: {...}]; cancel: [] }>();

watch(() => props.category, (category) => {
  name.value = category?.name ?? '';
  // ...
}, { immediate: true });

function onSubmit() {
  emit('submit', { name: name.value, ... });
}
</script>
```

`{ immediate: true }` on the watcher is what makes this work for *both* modes from the moment the form mounts — without it, opening the form in edit mode would render with empty fields until some later reactive trigger ran the watcher once. The parent view (`Categories.vue`) decides the HTTP verb entirely outside this component:

```ts
async function onSubmit(payload) {
  if (editing.value) await api.updateCategory(editing.value.id, payload);
  else await api.createCategory(payload);
}
```

## Concept: `KebabMenu` — click-outside-to-close via a document listener

```vue
<script setup lang="ts">
const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));
</script>
<template>
  <div class="kebab" ref="rootEl">
    <button @click="toggle">&#8942;</button>
    <div v-if="open" class="kebab-menu" @click="open = false"><slot /></div>
  </div>
</template>
```

Listening on `document` (not the component root) is what catches clicks anywhere else on the page. `rootEl.contains(e.target)` distinguishes "clicked inside this menu" from "clicked elsewhere," and `@click="open = false"` on the menu's own container means clicking any slotted button (Edit, Delete, ...) closes the menu as a side effect of the click bubbling up, without each consumer needing to remember to close it themselves.
