import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { Category, Department } from '../types';

// CategoryForm reads useAuth()'s `user` singleton (via isPersonal) and calls
// api.getDepartments()/api.createDepartment() on mount/create — mock the
// shared api module and reset the module graph per test, same isolation
// pattern as useAuth.test.ts, so one test's departments list can't leak
// into the next via useAuth's module-level `user` ref.
const mockApi = {
  getDepartments: vi.fn(),
  createDepartment: vi.fn(),
};

vi.mock('../api', () => ({ api: mockApi }));

beforeEach(() => {
  vi.resetModules();
  mockApi.getDepartments.mockReset();
  mockApi.createDepartment.mockReset();
});

async function mountForm(props: { category: Category | null; readonly?: boolean }) {
  const { default: CategoryForm } = await import('./CategoryForm.vue');
  return mount(CategoryForm, { props });
}

function fakeDepartment(id: number, name: string): Department {
  return { id, tenant_id: 1, name };
}

function fakeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    tenant_id: 1,
    name: 'Software',
    budgeted_amount: 500,
    start_on: '2026-08-01',
    department_id: 3,
    approval_threshold: 100,
    ...overrides,
  };
}

describe('department auto-selection on mount', () => {
  it('auto-selects the only department for a new category', async () => {
    mockApi.getDepartments.mockResolvedValue([fakeDepartment(3, 'Engineering')]);
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')![0][0]).toMatchObject({ department_id: 3 });
  });

  it('does not override an existing category’s department when there is only one option', async () => {
    mockApi.getDepartments.mockResolvedValue([fakeDepartment(3, 'Engineering')]);
    const wrapper = await mountForm({ category: fakeCategory({ department_id: 3 }) });
    await flushPromises();

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')![0][0]).toMatchObject({ department_id: 3 });
  });

  it('opens the new-department field automatically when there are zero departments', async () => {
    mockApi.getDepartments.mockResolvedValue([]);
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    expect(wrapper.find('input[placeholder="e.g. Engineering"]').exists()).toBe(true);
  });

  it('leaves department unselected when there are 2+ departments and no category', async () => {
    mockApi.getDepartments.mockResolvedValue([fakeDepartment(3, 'Engineering'), fakeDepartment(4, 'Marketing')]);
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue('Cloud hosting');
    await wrapper.find('input[type="number"]').setValue('50');
    await wrapper.find('form').trigger('submit');

    // department_id stays '' (never selected) -> submit coerces it to null.
    expect(wrapper.emitted('submit')![0][0]).toMatchObject({ department_id: null });
  });
});

describe('submit payload shape', () => {
  it('coerces an empty approval threshold to null, not NaN or empty string', async () => {
    mockApi.getDepartments.mockResolvedValue([fakeDepartment(3, 'Engineering')]);
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')![0][0]).toMatchObject({ approval_threshold: null });
  });

  it('coerces a filled approval threshold to a number', async () => {
    mockApi.getDepartments.mockResolvedValue([fakeDepartment(3, 'Engineering')]);
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    const thresholdInput = wrapper.find('input[placeholder="No threshold"]');
    await thresholdInput.setValue('250');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')![0][0]).toMatchObject({ approval_threshold: 250 });
  });

  it('populates every field from an existing category via the props watcher', async () => {
    mockApi.getDepartments.mockResolvedValue([fakeDepartment(3, 'Engineering')]);
    const category = fakeCategory({ name: 'Marketing Software', budgeted_amount: 1200, approval_threshold: 300 });
    const wrapper = await mountForm({ category });
    await flushPromises();

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')![0][0]).toMatchObject({
      name: 'Marketing Software',
      budgeted_amount: 1200,
      approval_threshold: 300,
    });
  });
});

describe('inline department creation', () => {
  it('creates a department, selects it, and closes the field on success', async () => {
    mockApi.getDepartments.mockResolvedValue([]);
    mockApi.createDepartment.mockResolvedValue(fakeDepartment(9, 'Support'));
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    await wrapper.find('input[placeholder="e.g. Engineering"]').setValue('Support');
    await wrapper.find('button.btn-secondary:not(.new-department-toggle)').trigger('click');
    await flushPromises();

    expect(mockApi.createDepartment).toHaveBeenCalledWith('Support');
    expect(wrapper.find('input[placeholder="e.g. Engineering"]').exists()).toBe(false);
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')![0][0]).toMatchObject({ department_id: 9 });
  });

  it('trims whitespace before submitting the department name', async () => {
    mockApi.getDepartments.mockResolvedValue([]);
    mockApi.createDepartment.mockResolvedValue(fakeDepartment(9, 'Support'));
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    await wrapper.find('input[placeholder="e.g. Engineering"]').setValue('  Support  ');
    await wrapper.find('button.btn-secondary:not(.new-department-toggle)').trigger('click');
    await flushPromises();

    expect(mockApi.createDepartment).toHaveBeenCalledWith('Support');
  });

  it('shows the API error message and keeps the field open on failure', async () => {
    mockApi.getDepartments.mockResolvedValue([]);
    mockApi.createDepartment.mockRejectedValue(new Error('A department with that name already exists'));
    const wrapper = await mountForm({ category: null });
    await flushPromises();

    await wrapper.find('input[placeholder="e.g. Engineering"]').setValue('Support');
    await wrapper.find('button.btn-secondary:not(.new-department-toggle)').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('A department with that name already exists');
    expect(wrapper.find('input[placeholder="e.g. Engineering"]').exists()).toBe(true);
  });
});
