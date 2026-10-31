import { useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';

/**
 * Movimiento de la portada. Cada animación guía la vista a un sitio una sola vez: nada se
 * repite en bucle, y con «reducir movimiento» activado todo aparece ya en su sitio.
 */
export const useLandingMotion = () => {
  const reduced = useReducedMotion();
  return { reduced: Boolean(reduced) };
};

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** Las palabras de un titular suben una detrás de otra. */
export const wordsContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

export const wordItem: Variants = {
  hidden: { y: '0.7em', opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Un bloque que sube al entrar en pantalla. */
export const rise: Variants = {
  hidden: { y: 28, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.55, ease: EASE_OUT } },
};

/** Los cromos se abren en abanico desde el centro. */
export const fanContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const fanItem = (angle: number): Variants => ({
  hidden: { y: 60, rotate: 0, opacity: 0 },
  show: { y: 0, rotate: angle, opacity: 1, transition: { duration: 0.6, ease: EASE_OUT } },
});

export const inViewOnce = { once: true, amount: 0.35 } as const;
