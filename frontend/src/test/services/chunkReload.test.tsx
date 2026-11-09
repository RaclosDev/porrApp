import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isChunkLoadError,
  lazyPage,
  reloadForStaleChunk,
  resetChunkReloadForTests,
} from '../../services/chunkReload';

const reload = vi.fn();
const originalLocation = window.location;

describe('recarga por trozo obsoleto tras un despliegue', () => {
  beforeEach(() => {
    reload.mockClear();
    sessionStorage.clear();
    resetChunkReloadForTests();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
    vi.useRealTimers();
  });

  it('reconoce el fallo de carga en Chrome, Firefox y Safari, y nada más', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://porrapp.app/assets/Stats-Bc0Mxj7c.js',
        ),
      ),
    ).toBe(true);
    expect(
      isChunkLoadError(new TypeError('error loading dynamically imported module: /assets/a.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('x is undefined'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it('recarga una vez y no vuelve a hacerlo hasta pasado el margen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T09:00:00Z'));

    expect(reloadForStaleChunk()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    // La página recargada empieza sin el indicador en memoria, pero sessionStorage sigue.
    resetChunkReloadForTests();
    vi.setSystemTime(new Date('2026-11-09T09:00:10Z'));
    expect(reloadForStaleChunk()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-11-09T09:01:00Z'));
    expect(reloadForStaleChunk()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('la pantalla diferida recarga en vez de fallar cuando su trozo ya no existe', async () => {
    const Stats = lazyPage<() => null>(() =>
      Promise.reject(
        new TypeError('Failed to fetch dynamically imported module: /assets/Stats-old.js'),
      ),
    );
    render(
      <Suspense fallback={<p>Cargando</p>}>
        <Stats />
      </Suspense>,
    );

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Cargando')).toBeInTheDocument();
  });
});
