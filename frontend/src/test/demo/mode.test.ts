import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const realStorage = window.localStorage;

async function loadMode(path: string) {
  window.history.replaceState(null, '', path);
  vi.resetModules();
  return import('../../demo/mode');
}

describe('modo demo', () => {
  beforeEach(() => {
    realStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { value: realStorage, configurable: true });
    window.history.replaceState(null, '', '/');
  });

  it('solo se activa al entrar por /demo y se mantiene en la pestaña', async () => {
    expect((await loadMode('/')).DEMO).toBe(false);
    expect((await loadMode('/demo')).DEMO).toBe(true);
    expect((await loadMode('/ranking')).DEMO).toBe(true);
  });

  it('prepara una sesión ficticia sin tocar el almacenamiento real', async () => {
    realStorage.setItem('my_user_id', '99');
    realStorage.setItem('porrapp:analytics-consent', 'rejected');
    const mode = await loadMode('/demo?liga=ufc');
    mode.startDemoStorage();

    expect(window.localStorage.getItem('my_user_id')).toBe(mode.DEMO_USER.id);
    expect(window.localStorage.getItem('my_prediction_name')).toBe(mode.DEMO_USER.name);
    expect(window.localStorage.getItem('activeGroupId')).toBe('39');
    expect(window.localStorage.getItem('porrapp:analytics-consent')).toBe('rejected');
    expect(realStorage.getItem('my_user_id')).toBe('99');
    expect(realStorage.getItem('activeGroupId')).toBeNull();
  });

  it('conserva lo hecho al recargar y deja cambiar de liga por enlace', async () => {
    let mode = await loadMode('/demo');
    mode.startDemoStorage();
    expect(window.localStorage.getItem('activeGroupId')).toBe('6');
    window.localStorage.setItem('borrador', 'x');
    window.localStorage.setItem('activeGroupId', '6');

    Object.defineProperty(window, 'localStorage', { value: realStorage, configurable: true });
    mode = await loadMode('/jornadas');
    mode.startDemoStorage();
    expect(window.localStorage.getItem('borrador')).toBe('x');
    expect(window.localStorage.getItem('activeGroupId')).toBe('6');
  });

  it('el almacenamiento de la demo se comporta como localStorage', async () => {
    const mode = await loadMode('/demo');
    window.sessionStorage.setItem('ajeno', '1');
    mode.startDemoStorage();
    const storage = window.localStorage;
    const size = storage.length;

    storage.setItem('nuevo', 'valor');
    expect(storage.length).toBe(size + 1);
    expect(storage.key(size + 1)).toBeNull();
    storage.removeItem('nuevo');
    expect(storage.getItem('nuevo')).toBeNull();
    storage.clear();
    expect(storage.length).toBe(0);
    expect(window.sessionStorage.getItem('ajeno')).toBe('1');
  });

  it('al salir borra lo suyo y vuelve a la aplicación real', async () => {
    const mode = await loadMode('/demo');
    mode.startDemoStorage();
    const go = vi.fn();
    mode.leaveDemo(go);

    expect(go).toHaveBeenCalledWith('/');
    expect(window.sessionStorage.length).toBe(0);
    expect((await loadMode('/')).DEMO).toBe(false);
  });
});
