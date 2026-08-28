import { ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

// Dark is the unconditional default (design doc: "Monarch/Origin-Inspired
// Design System" premise 5) — OS prefers-color-scheme is deliberately not
// consulted for the initial state, only an explicit stored choice ever
// overrides it. client/index.html runs the same read (inline, pre-mount)
// so the correct palette paints before Vue mounts; this composable is the
// runtime source of truth once the app is running, and keeps both in sync.
// localStorage access is best-effort, same convention as DashboardView's
// dashboardViewMode read/write — private-browsing/storage-disabled
// contexts throw on access, and since this runs at module load (line 18
// below), an uncaught throw here would prevent the whole app from
// mounting rather than just losing the persisted preference.
function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

const theme = ref<Theme>(readStoredTheme() ?? 'dark');

function applyTheme(value: Theme) {
  document.documentElement.dataset.theme = value;
}

// Apply immediately on module load (not just on first useTheme() call) so
// the theme is correct even if useTheme() is first called after other
// reactive setup has already read colors — matches index.html's pre-mount
// script, which already set this attribute; this keeps it in sync for the
// rest of the app's lifetime.
applyTheme(theme.value);

export function useTheme() {
  function setTheme(value: Theme) {
    theme.value = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Best-effort — the toggle still works for this session, it just
      // won't survive a reload in a storage-disabled context.
    }
    applyTheme(value);
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  return { theme, setTheme, toggleTheme };
}
