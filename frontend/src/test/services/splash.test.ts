import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadSplash() {
  vi.resetModules();
  return import('../../services/splash');
}

describe('pantalla de arranque', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-splash"></div><div id="root"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('se retira con un fundido y desaparece del documento', async () => {
    const { hideSplash, isSplashVisible } = await loadSplash();
    const splash = document.getElementById('app-splash');
    expect(isSplashVisible()).toBe(true);

    hideSplash();

    // Deja de contar como visible al empezar a irse: las rutas ya pueden enseñar su esqueleto.
    expect(isSplashVisible()).toBe(false);
    await waitFor(() => expect(splash).toHaveClass('is-leaving'));
    await waitFor(() => expect(document.getElementById('app-splash')).toBeNull());
  });

  it('se puede pedir varias veces y sin pantalla de arranque no hace nada', async () => {
    const { hideSplash, isSplashVisible } = await loadSplash();
    hideSplash();
    hideSplash();
    await waitFor(() => expect(document.getElementById('app-splash')).toBeNull());

    expect(() => hideSplash()).not.toThrow();
    expect(isSplashVisible()).toBe(false);
  });
});
