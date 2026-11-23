import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';

/**
 * Foto de perfil en grande, encima de todo (también de la hoja que la abrió). Se cierra pulsando
 * en cualquier sitio, con la X o con Escape; Escape no llega a la hoja de debajo, que sigue
 * abierta. Devuelve el foco a quien la abrió.
 */
export default function PhotoViewer({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    // En captura y en window: llega antes que el Escape y el Tab de la hoja de debajo.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        event.stopImmediatePropagation();
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    // Pulsar en cualquier sitio cierra: es un atajo de ratón; con teclado, Escape o la X.
    <div
      className="photo-viewer"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className="photo-viewer-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Foto de ${name}`}
      >
        <figure className="photo-viewer-figure">
          <img src={url} alt={`Foto de ${name}`} className="photo-viewer-img" />
          <figcaption className="photo-viewer-name">{name}</figcaption>
        </figure>
        <button
          ref={closeRef}
          type="button"
          className="photo-viewer-close"
          aria-label="Cerrar foto"
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
