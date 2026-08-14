import type {
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  Transaction,
  CreateTransactionDto,
  UpdateTransactionDto,
  RecurringTransaction,
  CreateRecurringTransactionDto,
  UpdateRecurringTransactionDto,
  DashboardResponse,
} from './types';

const BASE_URL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  getCategories: () => request<Category[]>('/categories'),
  createCategory: (dto: CreateCategoryDto) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(dto) }),
  updateCategory: (id: number, dto: UpdateCategoryDto) =>
    request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),

  getTransactions: () => request<Transaction[]>('/transactions'),
  createTransaction: (dto: CreateTransactionDto) =>
    request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(dto) }),
  updateTransaction: (id: number, dto: UpdateTransactionDto) =>
    request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
  deleteTransaction: (id: number) => request<void>(`/transactions/${id}`, { method: 'DELETE' }),

  getRecurringTransactions: () => request<RecurringTransaction[]>('/recurring-transactions'),
  createRecurringTransaction: (dto: CreateRecurringTransactionDto) =>
    request<RecurringTransaction>('/recurring-transactions', { method: 'POST', body: JSON.stringify(dto) }),
  updateRecurringTransaction: (id: number, dto: UpdateRecurringTransactionDto) =>
    request<RecurringTransaction>(`/recurring-transactions/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
  deleteRecurringTransaction: (id: number) => request<void>(`/recurring-transactions/${id}`, { method: 'DELETE' }),

  getDashboard: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request<DashboardResponse>(`/dashboard${qs ? `?${qs}` : ''}`);
  },
};
