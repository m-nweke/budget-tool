import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthUser, MembershipSummary } from '../types';

// useAuth's user/initialized/memberships refs are module-level singletons
// (see the comment in useAuth.ts) — every test needs a *fresh* module
// instance so one test's session state can't leak into the next. vi.mock
// is hoisted and set up once for the file; mockApi is a stable object the
// factory closes over, so re-importing '../api' after vi.resetModules()
// still returns the same mock functions to assert on, while re-importing
// './useAuth' gives a brand-new set of module-level refs.
const mockApi = {
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  selectTenant: vi.fn(),
  getMemberships: vi.fn(),
};

class MockApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

vi.mock('../api', () => ({
  api: mockApi,
  ApiError: MockApiError,
}));

beforeEach(() => {
  vi.resetModules();
  for (const fn of Object.values(mockApi)) fn.mockReset();
});

async function freshAuth() {
  const { useAuth } = await import('./useAuth');
  return useAuth();
}

function fakeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    name: 'Dana Head',
    email: 'dana@example.com',
    tenant_id: 1,
    tenant_type: 'enterprise',
    role: 'department_head',
    department_id: null,
    ...overrides,
  };
}

describe('fetchMe', () => {
  it('resolves the session and marks initialized on success', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockResolvedValue({ user: fakeUser() });

    const result = await auth.fetchMe();

    expect(result).toMatchObject({ email: 'dana@example.com' });
    expect(auth.user.value).toMatchObject({ email: 'dana@example.com' });
    expect(auth.initialized.value).toBe(true);
  });

  it('dedupes concurrent callers onto a single in-flight request', async () => {
    const auth = await freshAuth();
    let resolveGetMe: (v: { user: AuthUser }) => void;
    mockApi.getMe.mockReturnValue(
      new Promise((resolve) => {
        resolveGetMe = resolve;
      })
    );

    const first = auth.fetchMe();
    const second = auth.fetchMe();
    resolveGetMe!({ user: fakeUser() });
    await Promise.all([first, second]);

    expect(mockApi.getMe).toHaveBeenCalledTimes(1);
  });

  it('on a real 401, sets user null and still marks initialized (confirmed logged-out)', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockRejectedValue(new MockApiError('Unauthorized', 401));

    const result = await auth.fetchMe();

    expect(result).toBeNull();
    expect(auth.user.value).toBeNull();
    expect(auth.initialized.value).toBe(true);
  });

  it('on a non-401 failure, leaves initialized false so the next navigation retries', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockRejectedValue(new Error('network error'));

    await auth.fetchMe();

    expect(auth.user.value).toBeNull();
    expect(auth.initialized.value).toBe(false);
  });

  it('on a 500 ApiError, also leaves initialized false — only 401 confirms logged-out', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockRejectedValue(new MockApiError('Internal error', 500));

    await auth.fetchMe();

    expect(auth.initialized.value).toBe(false);
  });
});

describe('login', () => {
  it('a single-membership login sets the session and returns true', async () => {
    const auth = await freshAuth();
    mockApi.login.mockResolvedValue({ user: fakeUser() });

    const result = await auth.login('dana@example.com', 'correct-horse');

    expect(result).toBe(true);
    expect(auth.user.value).toMatchObject({ email: 'dana@example.com' });
    expect(auth.memberships.value).toEqual([]);
  });

  it('a multi-membership login populates the picker and returns false, without setting a session', async () => {
    const auth = await freshAuth();
    const memberships: MembershipSummary[] = [
      { tenant_id: 1, tenant_name: 'Acme Co', tenant_type: 'enterprise', role: 'department_head' },
      { tenant_id: 2, tenant_name: "Pat's Budget", tenant_type: 'personal', role: 'owner' },
    ];
    mockApi.login.mockResolvedValue({ memberships });

    const result = await auth.login('dana@example.com', 'correct-horse');

    expect(result).toBe(false);
    expect(auth.user.value).toBeNull();
    expect(auth.memberships.value).toEqual(memberships);
  });
});

describe('register', () => {
  it('always resolves directly to a session, never a picker', async () => {
    const auth = await freshAuth();
    mockApi.register.mockResolvedValue({ user: fakeUser({ role: 'owner' }) });

    await auth.register('Pat Personal', 'pat@example.com', 'hunter2', 'personal');

    expect(auth.user.value).toMatchObject({ role: 'owner' });
    expect(auth.initialized.value).toBe(true);
  });
});

describe('selectTenant', () => {
  it('sets the session for the chosen tenant and clears the picker', async () => {
    const auth = await freshAuth();
    mockApi.login.mockResolvedValue({
      memberships: [{ tenant_id: 2, tenant_name: 'B', tenant_type: 'enterprise', role: 'department_head' }],
    });
    await auth.login('dana@example.com', 'pw');
    mockApi.selectTenant.mockResolvedValue({ user: fakeUser({ tenant_id: 2 }) });

    await auth.selectTenant(2);

    expect(auth.user.value).toMatchObject({ tenant_id: 2 });
    expect(auth.memberships.value).toEqual([]);
  });
});

describe('logout', () => {
  it('clears the session on success', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockResolvedValue({ user: fakeUser() });
    await auth.fetchMe();
    mockApi.logout.mockResolvedValue(null);

    await auth.logout();

    expect(auth.user.value).toBeNull();
    expect(auth.memberships.value).toEqual([]);
  });

  it('still clears the client-side session even when the server request fails', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockResolvedValue({ user: fakeUser() });
    await auth.fetchMe();
    mockApi.logout.mockRejectedValue(new Error('offline'));

    await auth.logout();

    expect(auth.user.value).toBeNull();
  });
});

describe('fetchMemberships', () => {
  it('populates memberships from a dedicated call, independent of the login picker', async () => {
    const auth = await freshAuth();
    const memberships: MembershipSummary[] = [
      { tenant_id: 1, tenant_name: 'Acme Co', tenant_type: 'enterprise', role: 'department_head' },
    ];
    mockApi.getMemberships.mockResolvedValue({ memberships });

    await auth.fetchMemberships();

    expect(auth.memberships.value).toEqual(memberships);
  });
});

describe('role computeds', () => {
  it('isHead/canManageBudget/canApprove are true for a department_head, isOwner false', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockResolvedValue({ user: fakeUser({ role: 'department_head' }) });
    await auth.fetchMe();

    expect(auth.isHead.value).toBe(true);
    expect(auth.isOwner.value).toBe(false);
    expect(auth.canManageBudget.value).toBe(true);
    expect(auth.canApprove.value).toBe(true);
  });

  it('isOwner/canManageBudget/canApprove are true for an owner, isHead false', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockResolvedValue({ user: fakeUser({ role: 'owner', tenant_type: 'personal' }) });
    await auth.fetchMe();

    expect(auth.isHead.value).toBe(false);
    expect(auth.isOwner.value).toBe(true);
    expect(auth.canManageBudget.value).toBe(true);
    expect(auth.canApprove.value).toBe(true);
  });

  it('a department_employee gets neither permission', async () => {
    const auth = await freshAuth();
    mockApi.getMe.mockResolvedValue({
      user: fakeUser({ role: 'department_employee', department_id: 5 }),
    });
    await auth.fetchMe();

    expect(auth.canManageBudget.value).toBe(false);
    expect(auth.canApprove.value).toBe(false);
  });

  it('all permission computeds are false with no session', async () => {
    const auth = await freshAuth();

    expect(auth.isHead.value).toBe(false);
    expect(auth.isOwner.value).toBe(false);
    expect(auth.canManageBudget.value).toBe(false);
    expect(auth.canApprove.value).toBe(false);
  });
});
