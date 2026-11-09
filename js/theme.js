// Colour theme: follows the OS until the visitor picks one, then remembers it.
// The initial value is applied by an inline script in <head> to avoid a flash.

const STORAGE_KEY = 'theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: light)');

export function currentTheme() {
  return root.dataset.theme || (media.matches ? 'light' : 'dark');
}

function store(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage unavailable (private mode) — the choice just won't persist */
  }
}

function announce() {
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: currentTheme() } }));
}

export function initTheme(button, t) {
  const sync = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', t(`js.theme.to_${next}`, `Switch to ${next} theme`));
  };

  button.addEventListener('click', () => {
    root.dataset.theme = currentTheme() === 'dark' ? 'light' : 'dark';
    store(root.dataset.theme);
    sync();
    announce();
  });

  media.addEventListener('change', () => {
    if (!root.dataset.theme) {
      sync();
      announce();
    }
  });

  document.addEventListener('langchange', sync);
  sync();
}
