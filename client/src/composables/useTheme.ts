import { ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

// Dark is the unconditional default (design doc: "Monarch/Origin-Inspired
// Design System" premise 5) — OS prefers-color-scheme is deliberately not
// consulted for the initial state, only an explicit stored choice ever
// overrides it. client/index.html runs the same read (inline, pre-mount)
// so the correct palette paints before Vue mounts; this composable is the
// runtime source of truth once the app is running, and keeps both in sync.
function readStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
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
    localStorage.setItem(STORAGE_KEY, value);
    applyTheme(value);
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  return { theme, setTheme, toggleTheme };
}
