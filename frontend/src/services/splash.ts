/**
 * Pantalla de arranque de index.html (#app-splash): tapa la página mientras se descarga y monta
 * la app, y se retira con un fundido cuando la primera pantalla ya está pintada.
 */

/** Lo que dura el fundido de salida; igual que la transición de #app-splash en index.html. */
const FADE_MS = 200;
/** Espera máxima por las fuentes: en una recarga ya están en caché y llegan antes. */
const FONT_WAIT_MS = 400;
/** Si la app no avisa (error al cargar un trozo, por ejemplo), la pantalla se quita igualmente. */
export const SPLASH_FAILSAFE_MS = 6000;

/** Fuentes que se ven nada más entrar: la marca, los títulos y el texto. */
const FIRST_SCREEN_FONTS = ['1em "Permanent Marker"', '1em Outfit', '1em Inter'];

let leaving = false;
/** El fundido de salida ya ha empezado: la app se ve y sus animaciones de entrada pueden arrancar. */
let fading = false;
const listeners = new Set<() => void>();

/** La pantalla de arranque sigue tapando la app. */
export function isSplashVisible(): boolean {
  return !leaving && document.getElementById('app-splash') !== null;
}

/** Ya no hay pantalla de arranque delante, o se está yendo y la app ya se ve. */
export function isSplashGone(): boolean {
  return fading || document.getElementById('app-splash') === null;
}

/** Avisa cuando la pantalla de arranque empieza a irse (para useSyncExternalStore). */
export function subscribeSplashGone(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** La hoja de Google Fonts ya se ha aplicado (se carga sin bloquear, con media="print"). */
function fontStylesheetReady(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="stylesheet"][href*="fonts.googleapis.com"]',
  );
  if (!link || link.sheet) return Promise.resolve();
  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
}

/**
 * Las fuentes de la primera pantalla, para no enseñarla con la de sistema y cambiarla al momento.
 * Con un tope: en la primera visita con mala conexión es mejor ver el texto que esperar.
 */
function firstScreenFontsReady(): Promise<unknown> {
  if (!('fonts' in document)) return Promise.resolve();
  const fonts = fontStylesheetReady().then(() =>
    Promise.all(FIRST_SCREEN_FONTS.map((font) => document.fonts.load(font))),
  );
  const timeout = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  return Promise.race([fonts.catch(() => undefined), timeout]);
}

/** Quita la pantalla de arranque con un fundido. Se puede llamar varias veces. */
export function hideSplash(): void {
  const splash = document.getElementById('app-splash');
  if (!splash || leaving) return;
  leaving = true;
  void firstScreenFontsReady().then(() => {
    // Un fotograma para que el navegador pinte la app debajo antes de empezar el fundido.
    requestAnimationFrame(() => {
      splash.classList.add('is-leaving');
      fading = true;
      listeners.forEach((listener) => listener());
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => splash.remove(), reduceMotion ? 0 : FADE_MS);
    });
  });
}
