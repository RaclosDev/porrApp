import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import DialogBackdrop from './DialogBackdrop';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';

/**
 * Hoja modal: en el móvil sube desde abajo y se cierra deslizándola hacia abajo; en pantallas
 * anchas es un diálogo centrado. También se cierra con Escape, con la X o al pulsar fuera, y
 * devuelve el foco a quien la abrió. El contenido con scroll debe llevar `sheet-dialog-body`.
 */
export default function SheetDialog({
  title,
  subtitle,
  onClose,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  /** Clase extra del panel, para ajustes de una hoja concreta. */
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogFocus(panelRef, { onEscape: onClose });
  useSwipeToDismiss(panelRef, onClose);

  return createPortal(
    <DialogBackdrop className="friends-predictions-overlay" onDismiss={onClose}>
      <div
        className={`friends-predictions-panel sheet-dialog paper-panel paper-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="sheet-dialog-handle" aria-hidden="true" />
        <div className="sheet-dialog-head">
          <div className="min-w-0">
            <h2 id={titleId} className="sheet-dialog-title">
              {title}
            </h2>
            {subtitle && <p className="sheet-dialog-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="sheet-dialog-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
        {children}
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
