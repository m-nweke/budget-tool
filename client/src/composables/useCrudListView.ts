import { ref, onMounted, type Ref } from 'vue';
import { useConfirmDelete } from './useConfirmDelete';

export interface CrudApi<T, CreateDto> {
  create(data: CreateDto): Promise<T>;
  update(id: number, data: CreateDto): Promise<T>;
  // api.ts's delete* methods resolve to `null` (request<null>(...)), not void
  // — unknown accepts either without callers needing to care about the
  // distinction.
  remove(id: number): Promise<unknown>;
}

// Every CRUD list view in this app (Accounts, Debts, Goals, Bills, Paycheck,
// Categories) hand-rolled the same ~50 lines: a showForm/editingItem/
// formReadonly/error/loaded/viewTop ref set, scrollToForm, open{Create,Edit,
// View}Form/closeForm, handleSubmit/handleDelete, and useConfirmDelete
// wiring. This composable owns all of that; each view keeps only its
// template + list-item markup + any secondary data it loads alongside its
// primary list (department names, linked accounts, a payoff plan, etc.).
//
// `load` returns the primary item array — a view that needs secondary data
// (e.g. CategoriesView also needs departments) fetches it inside its own
// `load` closure, assigns it to a ref the view owns directly, and returns
// just the primary array. The composable never needs to know about that
// secondary data.
export function useCrudListView<T extends { id: number }, CreateDto>(
  load: () => Promise<T[]>,
  api: CrudApi<T, CreateDto>
) {
  const items = ref<T[]>([]) as Ref<T[]>;
  const showForm = ref(false);
  const editingItem = ref<T | null>(null) as Ref<T | null>;
  const formReadonly = ref(false);
  const error = ref('');
  const loaded = ref(false);
  const viewTop = ref<HTMLElement | null>(null);

  function scrollToForm() {
    viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadItems() {
    items.value = await load();
    loaded.value = true;
  }

  function openCreateForm() {
    editingItem.value = null;
    formReadonly.value = false;
    showForm.value = true;
    scrollToForm();
  }

  function openEditForm(item: T) {
    editingItem.value = item;
    formReadonly.value = false;
    showForm.value = true;
    scrollToForm();
  }

  function openViewForm(item: T) {
    editingItem.value = item;
    formReadonly.value = true;
    showForm.value = true;
    scrollToForm();
  }

  function closeForm() {
    showForm.value = false;
    editingItem.value = null;
  }

  async function handleSubmit(data: CreateDto) {
    error.value = '';
    try {
      if (editingItem.value) {
        await api.update(editingItem.value.id, data);
      } else {
        await api.create(data);
      }
      closeForm();
      await loadItems();
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  async function handleDelete(item: T) {
    error.value = '';
    try {
      await api.remove(item.id);
      await loadItems();
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  const { pending: pendingDelete, requestDelete, cancel: cancelDelete, confirm: confirmDelete } =
    useConfirmDelete(handleDelete);

  onMounted(loadItems);

  return {
    items,
    showForm,
    editingItem,
    formReadonly,
    error,
    loaded,
    viewTop,
    scrollToForm,
    loadItems,
    openCreateForm,
    openEditForm,
    openViewForm,
    closeForm,
    handleSubmit,
    handleDelete,
    pendingDelete,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
