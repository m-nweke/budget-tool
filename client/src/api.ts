import type {
  Category,
  CreateCategoryDto,
  Transaction,
  CreateTransactionDto,
  DashboardRow,
  RecurringTransaction,
  CreateRecurringTransactionDto,
  UpdateRecurringTransactionDto,
  AuthUser,
  Department,
  MembershipSummary,
  BankAccount,
  CreateBankAccountDto,
  Paycheck,
  CreatePaycheckDto,
  SavingsGoal,
  CreateSavingsGoalDto,
  Debt,
  CreateDebtDto,
  CashFlowResult,
} from './types';

export type AccountType = 'personal' | 'company' | 'join';

// Mirrors server/src/types/auth/LoginResponse.ts's union: a single-
// membership login (or /me, /select-tenant, /register) sets a session and
// returns `user` directly; a multi-membership login sets no cookie yet and
// returns `memberships` instead — the caller must call selectTenant next.
export type LoginResult = { user: AuthUser } | { memberships: MembershipSummary[] };

const BASE = '/api';

// Carries the HTTP status alongside the message so callers that need to
// distinguish failure modes (e.g. useAuth's fetchMe telling a real 401
// apart from a network/server error) don't have to re-parse the message.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    // fetch's default is 'same-origin', which already sends the httpOnly
    // auth cookie for this app's normal same-origin deployment — 'include'
    // is set explicitly so cookies still go out if the API is ever served
    // from a different origin/port than the client.
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed with status ${res.status}`, res.status);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<null>('/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: AuthUser }>('/auth/me'),
  register: (name: string, email: string, password: string, accountType: AccountType, joinCode?: string) =>
    request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, accountType, joinCode }),
    }),
  selectTenant: (tenantId: number) =>
    request<{ user: AuthUser }>('/auth/select-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId }),
    }),
  getMemberships: () => request<{ memberships: MembershipSummary[] }>('/auth/memberships'),

  getDepartments: () => request<Department[]>('/departments'),
  createDepartment: (name: string) =>
    request<Department>('/departments', { method: 'POST', body: JSON.stringify({ name }) }),

  getCategories: () => request<Category[]>('/categories'),
  createCategory: (data: CreateCategoryDto) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: CreateCategoryDto) =>
    request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request<null>(`/categories/${id}`, { method: 'DELETE' }),

  getTransactions: () => request<Transaction[]>('/transactions'),
  createTransaction: (data: CreateTransactionDto) =>
    request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: number, data: CreateTransactionDto) =>
    request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id: number) => request<null>(`/transactions/${id}`, { method: 'DELETE' }),
  approveTransaction: (id: number) => request<Transaction>(`/transactions/${id}/approve`, { method: 'POST' }),
  rejectTransaction: (id: number) => request<Transaction>(`/transactions/${id}/reject`, { method: 'POST' }),

  getPendingApprovals: () => request<Transaction[]>('/approvals'),

  getDashboard: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<DashboardRow[]>(`/dashboard${query ? `?${query}` : ''}`);
  },

  getBankAccounts: () => request<BankAccount[]>('/bank-accounts'),
  createBankAccount: (data: CreateBankAccountDto) =>
    request<BankAccount>('/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateBankAccount: (id: number, data: CreateBankAccountDto) =>
    request<BankAccount>(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBankAccount: (id: number) => request<null>(`/bank-accounts/${id}`, { method: 'DELETE' }),

  getPaychecks: () => request<Paycheck[]>('/paychecks'),
  createPaycheck: (data: CreatePaycheckDto) =>
    request<Paycheck>('/paychecks', { method: 'POST', body: JSON.stringify(data) }),
  updatePaycheck: (id: number, data: CreatePaycheckDto) =>
    request<Paycheck>(`/paychecks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePaycheck: (id: number) => request<null>(`/paychecks/${id}`, { method: 'DELETE' }),

  getSavingsGoals: () => request<SavingsGoal[]>('/savings-goals'),
  createSavingsGoal: (data: CreateSavingsGoalDto) =>
    request<SavingsGoal>('/savings-goals', { method: 'POST', body: JSON.stringify(data) }),
  updateSavingsGoal: (id: number, data: CreateSavingsGoalDto) =>
    request<SavingsGoal>(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSavingsGoal: (id: number) => request<null>(`/savings-goals/${id}`, { method: 'DELETE' }),

  getDebts: () => request<Debt[]>('/debts'),
  createDebt: (data: CreateDebtDto) => request<Debt>('/debts', { method: 'POST', body: JSON.stringify(data) }),
  updateDebt: (id: number, data: CreateDebtDto) =>
    request<Debt>(`/debts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDebt: (id: number) => request<null>(`/debts/${id}`, { method: 'DELETE' }),

  getRecurringTransactions: () => request<RecurringTransaction[]>('/recurring-transactions'),
  createRecurringTransaction: (data: CreateRecurringTransactionDto) =>
    request<RecurringTransaction>('/recurring-transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRecurringTransaction: (id: number, data: UpdateRecurringTransactionDto) =>
    request<RecurringTransaction>(`/recurring-transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteRecurringTransaction: (id: number) =>
    request<null>(`/recurring-transactions/${id}`, { method: 'DELETE' }),

  getCashFlow: (months?: number) => {
    const params = months !== undefined ? `?months=${months}` : '';
    return request<CashFlowResult>(`/cash-flow${params}`);
  },
};
