import { useEffect, type RefObject } from 'react';

interface Options {
  /** Fracción de la ventana donde el borde superior del elemento marca el 0 %. */
  start: number;
  /** Fracción de la ventana donde el borde inferior del elemento marca el 100 %. */
  end: number;
  enabled: boolean;
}

/**
 * Avance (0–1) del scroll respecto a un elemento: 0 cuando su borde superior llega a `start` de
 * la ventana y 1 cuando su borde inferior llega a `end`. Llama a `apply` en cada cambio.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  apply: (progress: number) => void,
  { start, end, enabled }: Options,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = element.getBoundingClientRect();
      const viewport = window.innerHeight;
      const span = start * viewport - (end * viewport - height);
      apply(span > 0 ? Math.min(1, Math.max(0, (start * viewport - top) / span)) : 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [ref, apply, start, end, enabled]);
}
