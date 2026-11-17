/**
 * Modo demo: la aplicación completa con una sesión ficticia y datos de ejemplo en memoria. Se entra
 * por /demo y dura lo que la pestaña. No llama al servidor ni toca la sesión, los borradores o las
 * preferencias reales guardadas en este navegador.
 */

const FLAG = 'porrapp-demo';
const PREFIX = 'porrapp-demo:';

/** Ligas de ejemplo, también por enlace directo: /demo?liga=ufc. */
export const DEMO_LEAGUES = [
  { slug: 'mundial', id: '1', label: 'Mundial' },
  { slug: 'laliga', id: '6', label: 'LaLiga' },
  { slug: 'ufc', id: '39', label: 'UFC' },
] as const;

/** Quien visita la demo entra como este participante ficticio de las tres ligas. */
export const DEMO_USER = { id: '7', name: 'Marta' } as const;

function detectDemo(): boolean {
  try {
    if (window.location.pathname === '/demo') {
      window.sessionStorage.setItem(FLAG, '1');
      return true;
    }
    return window.sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export const DEMO = detectDemo();

/** `localStorage` de la demo: vive en `sessionStorage` con prefijo, aparte del real. */
class DemoStorage implements Storage {
  private readonly store: Storage;

  constructor(store: Storage) {
    this.store = store;
  }

  private keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.store.length; i++) {
      const key = this.store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key.slice(PREFIX.length));
    }
    return keys;
  }

  get length() {
    return this.keys().length;
  }

  clear() {
    this.keys().forEach((key) => this.removeItem(key));
  }

  getItem(key: string) {
    return this.store.getItem(PREFIX + key);
  }

  key(index: number) {
    return this.keys()[index] ?? null;
  }

  removeItem(key: string) {
    this.store.removeItem(PREFIX + key);
  }

  setItem(key: string, value: string) {
    this.store.setItem(PREFIX + key, String(value));
  }
}

/** Sustituye `localStorage` por el de la demo y deja la sesión ficticia preparada. */
export function startDemoStorage(): void {
  const real = window.localStorage;
  const storage = new DemoStorage(window.sessionStorage);
  const slug = new URLSearchParams(window.location.search).get('liga');
  const league = DEMO_LEAGUES.find((item) => item.slug === slug);

  if (storage.getItem('has_session') === null) {
    storage.setItem('has_session', '1');
    storage.setItem('my_prediction_name', DEMO_USER.name);
    storage.setItem('my_user_id', DEMO_USER.id);
    storage.setItem('activeGroupId', DEMO_LEAGUES[0].id);
    // Ofrecer una llave de acceso o instalar la app no tiene sentido con una cuenta de ejemplo.
    storage.setItem(`passkey_prompt_answered:${DEMO_USER.id}`, '1');
    storage.setItem('pwa_banner_dismissed', 'true');
    // El aviso de cookies ya respondido en este dispositivo no se repite.
    const consent = real.getItem('porrapp:analytics-consent');
    if (consent !== null) storage.setItem('porrapp:analytics-consent', consent);
  }
  if (league) storage.setItem('activeGroupId', league.id);

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

/** Sale de la demo: borra lo suyo y recarga la aplicación real. */
export function leaveDemo(go: (url: string) => void = (url) => window.location.assign(url)): void {
  const session = window.sessionStorage;
  new DemoStorage(session).clear();
  session.removeItem(FLAG);
  go('/');
}
