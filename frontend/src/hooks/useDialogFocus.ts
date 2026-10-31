import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

interface DialogFocusOptions {
  /** Si el diálogo está abierto. Por defecto, mientras el componente está montado. */
  active?: boolean;
  /** Se llama al pulsar Escape. Sin él, Escape no hace nada desde este hook. */
  onEscape?: () => void;
  /** Zona donde se atrapa el foco; por defecto, el propio contenedor (p. ej. una confirmación anidada). */
  getScope?: () => HTMLElement | null | undefined;
}

/** Diálogos abiertos, del más antiguo al más reciente: solo el último atiende el teclado. */
const openDialogs: symbol[] = [];

/**
 * Gestión de foco de un diálogo modal: lo enfoca al abrir, atrapa el foco con Tab,
 * cierra con Escape y devuelve el foco al elemento que lo abrió al cerrarse.
 * El contenedor debe poder recibir foco (`tabIndex={-1}`).
 */
export function useDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  { active = true, onEscape, getScope }: DialogFocusOptions = {},
) {
  // Siempre la última versión de los callbacks, sin volver a registrar el listener.
  const optionsRef = useRef({ onEscape, getScope });
  useEffect(() => {
    optionsRef.current = { onEscape, getScope };
  });

  useEffect(() => {
    if (!active) return;
    const id = Symbol('dialog');
    openDialogs.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    containerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return;

      if (event.key === 'Escape') {
        const { onEscape: escape } = optionsRef.current;
        if (escape) {
          event.preventDefault();
          escape();
        }
        return;
      }

      if (event.key !== 'Tab') return;
      const scope = optionsRef.current.getScope?.() ?? containerRef.current;
      if (!scope) return;
      const focusables = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        scope.focus?.();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      const outsideScope = !scope.contains(activeEl);
      if (event.shiftKey && (activeEl === first || activeEl === scope || outsideScope)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeEl === last || outsideScope)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = openDialogs.indexOf(id);
      if (index !== -1) openDialogs.splice(index, 1);
      if (opener?.isConnected) opener.focus();
    };
  }, [active, containerRef]);
}
