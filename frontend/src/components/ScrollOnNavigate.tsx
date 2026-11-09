import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Lo que se espera a que la página nueva (perezosa o con datos) tenga sitio para el scroll. */
const RESTORE_TIMEOUT_MS = 1500;
/** Si la persona toca o hace scroll mientras tanto, manda ella. */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
const STORAGE_KEY = 'porra.scrollPositions';
/**
 * Clave de la primera entrada cuando el historial no trae una propia: la comparten todas las
 * cargas de la pestaña, así que su posición no vale de una carga a otra.
 */
const DEFAULT_KEY = 'default';

/** Posición de cada entrada del historial, por su `location.key`; sobrevive a recargar. */
const positions = new Map<string, number>(readStoredPositions());

function readStoredPositions(): [string, number][] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const entries = stored ? (JSON.parse(stored) as [string, number][]) : [];
    return entries.filter(([key]) => key !== DEFAULT_KEY);
  } catch {
    return [];
  }
}

function storePositions() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...positions]));
  } catch {
    // Sin almacenamiento solo se pierde la posición al recargar.
  }
}

/**
 * Repite `attempt` en cada fotograma hasta que diga que ha terminado, se agote el tiempo o la
 * persona mueva la página. Devuelve la función que lo cancela.
 */
function retryUntilDone(attempt: () => boolean): () => void {
  const deadline = performance.now() + RESTORE_TIMEOUT_MS;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    USER_SCROLL_EVENTS.forEach((type) => window.removeEventListener(type, stop));
  };
  const tick = () => {
    if (attempt() || performance.now() > deadline) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  USER_SCROLL_EVENTS.forEach((type) => window.addEventListener(type, stop, { passive: true }));
  tick();
  return stop;
}

function jumpTo(top: number) {
  // Instantáneo salvo que el enlace pida subir con suavidad (ver `SMOOTH_SCROLL_STATE`).
  window.scrollTo({ top, left: 0, behavior: 'instant' });
}

/**
 * Estado de un enlace cuya página nueva debe subir arriba con suavidad en vez de aparecer ya
 * arriba, como los del pie de las páginas públicas. Con movimiento reducido el salto es instantáneo.
 */
export const SMOOTH_SCROLL_STATE = { smoothScroll: true } as const;

function wantsSmoothScroll(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as { smoothScroll?: unknown }).smoothScroll === true
  );
}

function scrollToTop(smooth: boolean) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (smooth && !reduceMotion) window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  else jumpTo(0);
}

/**
 * Scroll al navegar, como en una web de páginas: la página nueva empieza arriba, un `#ancla`
 * lleva a su elemento y atrás/adelante vuelven a donde estaba cada página. Cambiar solo la query
 * (filtros, jornada) no mueve la página.
 */
export default function ScrollOnNavigate() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const smooth = wantsSmoothScroll(location.state);
  const currentKey = useRef(location.key);
  const previousPathname = useRef(location.pathname);
  const isFirstRender = useRef(true);

  // El navegador restauraría antes de que la página tenga contenido; se hace aquí.
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const save = () => positions.set(currentKey.current, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', storePositions);
    return () => {
      window.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', storePositions);
    };
  }, []);

  useLayoutEffect(() => {
    currentKey.current = location.key;
    const pathnameChanged = previousPathname.current !== location.pathname;
    previousPathname.current = location.pathname;
    const isInitialLoad = isFirstRender.current;
    isFirstRender.current = false;

    if (navigationType === 'POP') {
      // Al cargar, solo se recupera la posición de una entrada propia (una recarga).
      const saved =
        isInitialLoad && location.key === DEFAULT_KEY ? undefined : positions.get(location.key);
      if (saved !== undefined) {
        return retryUntilDone(() => {
          jumpTo(saved);
          return Math.abs(window.scrollY - saved) < 2;
        });
      }
      if (pathnameChanged) jumpTo(0);
      return undefined;
    }

    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      return retryUntilDone(() => {
        const target = document.getElementById(id);
        target?.scrollIntoView({ block: 'start' });
        return target !== null;
      });
    }

    if (pathnameChanged) scrollToTop(smooth);
    return undefined;
  }, [location.key, location.pathname, location.hash, navigationType, smooth]);

  return null;
}
