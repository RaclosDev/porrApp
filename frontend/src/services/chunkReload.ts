import React from 'react';

/**
 * Tras un despliegue, los trozos de la versión anterior (`assets/Stats-<hash>.js`) dejan de existir. Una pestaña
 * abierta desde antes sigue pidiéndolos al cambiar de pantalla y la carga falla. Lo arregla recargar la página una
 * vez, que trae el índice nuevo. El margen evita un bucle de recargas si el fallo es otro (sin conexión, p. ej.).
 */
const RELOAD_KEY = 'porrapp:chunk-reload-at';
const MIN_RELOAD_GAP_MS = 30_000;
let reloading = false;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR.test(message);
}

/** Recarga la página si no se ha hecho hace poco. Devuelve si la ha recargado. */
export function reloadForStaleChunk(): boolean {
  if (reloading) return true;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < MIN_RELOAD_GAP_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Sin sessionStorage no hay forma de evitar el bucle: mejor enseñar el error.
    return false;
  }
  reloading = true;
  window.location.reload();
  return true;
}

/** `React.lazy` que, si el trozo ya no existe tras un despliegue, recarga en vez de fallar. */
export const lazyPage: typeof React.lazy = (factory) =>
  React.lazy(() =>
    factory().catch((error: unknown) => {
      // Mientras la página se recarga no se pinta nada: la promesa no se resuelve nunca.
      if (reloading || (isChunkLoadError(error) && reloadForStaleChunk()))
        return new Promise<never>(() => {});
      throw error;
    }),
  );

/**
 * Lo mismo para la precarga de Vite (CSS y dependencias de cada trozo). El error sigue su curso: `lazyPage` lo
 * recibe y espera a la recarga en vez de enseñarlo.
 */
export function installChunkReload(): void {
  window.addEventListener('vite:preloadError', () => {
    reloadForStaleChunk();
  });
}

/** Solo para tests. */
export function resetChunkReloadForTests(): void {
  reloading = false;
}
