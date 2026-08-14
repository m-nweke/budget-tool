import type {
  Category,
  CreateCategoryDto,
  Transaction,
  CreateTransactionDto,
  DashboardRow,
  RecurringTransaction,
  CreateRecurringTransactionDto,
  UpdateRecurringTransactionDto,
} from './types';

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
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

  getDashboard: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<DashboardRow[]>(`/dashboard${query ? `?${query}` : ''}`);
  },

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
};
