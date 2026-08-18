import { ref } from 'vue';
import { api } from '../api';
import type { Transaction } from '../types';

// Module-level singleton, same reasoning as useAuth: NavBar's badge and
// ApprovalsView's list both need the same pending count, and NavBar never
// remounts on navigation (App.vue renders it once, RouterView swaps around
// it) — so without a shared ref, approving/rejecting in ApprovalsView would
// leave the badge stale until some unrelated remount.
const pending = ref<Transaction[]>([]);

export function usePendingApprovals() {
  async function refresh(): Promise<void> {
    pending.value = await api.getPendingApprovals();
  }

  return { pending, refresh };
}
