export type Theme = 'dark' | 'light';

const KEY = 'porrapp-theme';
const BAR = { dark: '#0f172a', light: '#efe9da' } as const;

/** Tema guardado; por defecto el oscuro, que es el de la marca. */
export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* Sin almacenamiento el tema vale solo para esta visita. */
  }
  applyTheme(theme);
}

applyTheme(getTheme());
