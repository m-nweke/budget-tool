import { ref } from 'vue';

// Wraps a destructive action behind an explicit confirm step, for use with
// ConfirmDialog.vue: requestDelete(item) stages it (opens the dialog), cancel()
// discards the stage, confirm() runs deleteFn against the staged item and
// clears the stage first — so a slow request can't leave the dialog open
// mid-delete or let a second click re-fire it. A small, single-purpose
// composable deliberately kept separate from any full CRUD-view composable —
// it only owns the confirm/cancel/pending state, not the surrounding
// load/create/edit lifecycle.
export function useConfirmDelete<T>(deleteFn: (item: T) => Promise<void>) {
  const pending = ref<T | null>(null);

  function requestDelete(item: T): void {
    pending.value = item;
  }

  function cancel(): void {
    pending.value = null;
  }

  async function confirm(): Promise<void> {
    if (pending.value === null) return;
    const item = pending.value;
    pending.value = null;
    await deleteFn(item);
  }

  return { pending, requestDelete, cancel, confirm };
}
