import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Transaction } from '../types';

const mockApi = { getPendingApprovals: vi.fn() };

vi.mock('../api', () => ({ api: mockApi }));

beforeEach(() => {
  vi.resetModules();
  mockApi.getPendingApprovals.mockReset();
});

async function freshPendingApprovals() {
  const { usePendingApprovals } = await import('./usePendingApprovals');
  return usePendingApprovals();
}

function fakeTransaction(id: number): Transaction {
  return {
    id,
    amount: 100,
    date: '2026-08-01',
    description: 'Test',
    category_id: 1,
    recurring_transaction_id: null,
    needs_approval: true,
    approved: false,
    created_by: 1,
  };
}

describe('refresh', () => {
  it('populates pending from the API', async () => {
    const { pending, refresh } = await freshPendingApprovals();
    mockApi.getPendingApprovals.mockResolvedValue([fakeTransaction(1), fakeTransaction(2)]);

    await refresh();

    expect(pending.value).toHaveLength(2);
    expect(pending.value.map((t) => t.id)).toEqual([1, 2]);
  });

  it('replaces, not appends to, the previous list', async () => {
    const { pending, refresh } = await freshPendingApprovals();
    mockApi.getPendingApprovals.mockResolvedValueOnce([fakeTransaction(1)]);
    await refresh();
    expect(pending.value).toHaveLength(1);

    mockApi.getPendingApprovals.mockResolvedValueOnce([fakeTransaction(2), fakeTransaction(3)]);
    await refresh();

    expect(pending.value.map((t) => t.id)).toEqual([2, 3]);
  });

  it('can clear down to an empty list once everything is approved/rejected', async () => {
    const { pending, refresh } = await freshPendingApprovals();
    mockApi.getPendingApprovals.mockResolvedValueOnce([fakeTransaction(1)]);
    await refresh();
    expect(pending.value).toHaveLength(1);

    mockApi.getPendingApprovals.mockResolvedValueOnce([]);
    await refresh();

    expect(pending.value).toEqual([]);
  });
});

describe('module-level singleton sharing', () => {
  it('two separate usePendingApprovals() calls share the same pending ref', async () => {
    // The whole point of the module-level singleton (per the source comment):
    // NavBar's badge and ApprovalsView's list must observe the same data
    // without NavBar needing to remount.
    const { usePendingApprovals } = await import('./usePendingApprovals');
    const navBarInstance = usePendingApprovals();
    const approvalsViewInstance = usePendingApprovals();
    mockApi.getPendingApprovals.mockResolvedValue([fakeTransaction(1)]);

    await approvalsViewInstance.refresh();

    expect(navBarInstance.pending.value).toHaveLength(1);
    expect(navBarInstance.pending.value).toBe(approvalsViewInstance.pending.value);
  });
});
