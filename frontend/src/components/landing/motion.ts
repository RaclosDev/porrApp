import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSplashGone } from '../../hooks/useSplashGone';

/**
 * Movimiento de la portada, sin librería: las transiciones viven en `landing-motion.css` y aquí
 * solo se decide cuándo empiezan. Cada animación guía la vista a un sitio una sola vez: nada se
 * repite en bucle, y con «reducir movimiento» activado todo aparece ya en su sitio.
 */
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeReduced = (notify: () => void) => {
  const query = window.matchMedia?.(REDUCED_QUERY);
  query?.addEventListener?.('change', notify);
  return () => query?.removeEventListener?.('change', notify);
};
const readReduced = () => window.matchMedia?.(REDUCED_QUERY).matches ?? false;

/** `visible` dice si ya se ve la página: hasta entonces las animaciones esperan. */
export const useLandingMotion = () => {
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => false);
  // Con la pantalla de arranque delante las animaciones no se verían: esperan a que se vaya.
  const visible = useSplashGone();
  return { reduced, visible };
};

/**
 * Marca el elemento con `data-in` cuando toca animarlo: al cargar (`onLoad`) o la primera vez que
 * entra en pantalla. El CSS hace el resto.
 */
export function useReveal<T extends HTMLElement>(onLoad = false) {
  const ref = useRef<T>(null);
  const visible = useSplashGone();
  useEffect(() => {
    const element = ref.current;
    if (!element || !visible) return;
    if (onLoad || typeof IntersectionObserver === 'undefined') {
      element.dataset.in = '';
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.dataset.in = '';
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [onLoad, visible]);
  return ref;
}

/** Estilo de un elemento que se anima: su posición en la cascada y sus ajustes. */
export const revealStyle = (vars: Record<string, string | number>) => vars as React.CSSProperties;
