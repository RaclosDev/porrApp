import { useEffect, useRef, type RefObject } from 'react';

/** Distancia mínima, en píxeles, para cerrar al soltar. */
const CLOSE_DISTANCE = 110;
/** Velocidad, en px/ms, que cierra aunque el gesto sea corto. */
const CLOSE_VELOCITY = 0.5;
/** Movimiento que decide si el gesto es arrastrar la hoja o desplazar la lista. */
const SLOP = 6;
const CLOSE_MS = 200;

/** El contenedor con scroll más cercano al dedo dentro de la hoja, si lo hay. */
function scrollableAncestor(target: EventTarget | null, panel: HTMLElement): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== panel) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Cierra una hoja al deslizarla hacia abajo con el dedo, como las hojas nativas de iOS y Android.
 * La hoja sigue al dedo; al soltar se cierra si ha bajado lo bastante o deprisa, y si no vuelve a
 * su sitio. Si el dedo empieza en una lista que no está arriba del todo, el gesto desplaza la lista.
 * El fondo (el padre de la hoja) se aclara a medida que baja.
 */
export function useSwipeToDismiss(panelRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const backdrop = panel.parentElement;

    let startY = 0;
    let startTime = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let tracking = false;
    let dragging = false;
    let closing = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const setOffset = (offset: number) => {
      panel.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
      if (backdrop) {
        const height = panel.offsetHeight || window.innerHeight;
        backdrop.style.opacity = offset > 0 ? String(Math.max(0.2, 1 - offset / height)) : '';
      }
    };

    const setTransition = (value: string) => {
      panel.style.transition = value;
      if (backdrop) backdrop.style.transition = value === 'none' ? 'none' : 'opacity 0.2s ease';
    };

    const onTouchStart = (event: TouchEvent) => {
      if (closing || event.touches.length !== 1) {
        tracking = false;
        return;
      }
      const scroller = scrollableAncestor(event.target, panel);
      tracking = !scroller || scroller.scrollTop <= 0;
      dragging = false;
      startY = lastY = event.touches[0].clientY;
      startTime = lastTime = event.timeStamp;
      velocity = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      const y = event.touches[0].clientY;
      const offset = y - startY;
      if (!dragging) {
        if (offset < -SLOP) {
          tracking = false;
          return;
        }
        if (offset <= SLOP) return;
        dragging = true;
        setTransition('none');
      }
      if (event.cancelable) event.preventDefault();
      const elapsed = event.timeStamp - lastTime;
      if (elapsed > 0) velocity = (y - lastY) / elapsed;
      lastY = y;
      lastTime = event.timeStamp;
      setOffset(Math.max(0, offset));
    };

    const onTouchEnd = () => {
      if (!dragging) {
        tracking = false;
        return;
      }
      tracking = false;
      dragging = false;
      const offset = lastY - startY;
      const quick = velocity > CLOSE_VELOCITY && lastTime - startTime < 400;
      if (offset > CLOSE_DISTANCE || (quick && offset > SLOP * 4)) {
        closing = true;
        if (prefersReducedMotion()) {
          onDismissRef.current();
          return;
        }
        setTransition(`transform ${CLOSE_MS}ms ease-in`);
        setOffset(panel.offsetHeight + offset || window.innerHeight);
        closeTimer = setTimeout(() => onDismissRef.current(), CLOSE_MS);
        return;
      }
      setTransition('transform 0.2s ease-out');
      setOffset(0);
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd);
    panel.addEventListener('touchcancel', onTouchEnd);
    return () => {
      clearTimeout(closeTimer);
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [panelRef]);
}
