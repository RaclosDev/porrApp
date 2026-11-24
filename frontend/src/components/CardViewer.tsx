import { createPortal } from 'react-dom';
import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Cromo en grande, encima de todo: entra girando desde el dorso, como un cromo de logro que se
 * destapa. Se cierra pulsando fuera, con la X o con Escape, y devuelve el foco a quien lo abrió.
 * Escuchar en `document` sin captura deja que un `PhotoViewer` abierto encima cierre antes.
 */
export default function CardViewer({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Con el cromo abierto, la página de detrás no se desplaza.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const previous = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      [html.style.overflow, body.style.overflow] = previous;
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="card-viewer"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="card-viewer-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="card-viewer-card">
          <div className="card-viewer-front">{children}</div>
          <div className="card-viewer-back" aria-hidden="true">
            <span>PorrApp</span>
          </div>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="photo-viewer-close"
          aria-label="Cerrar cromo"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}
