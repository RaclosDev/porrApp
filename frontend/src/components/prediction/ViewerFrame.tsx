import type { ReactNode, RefObject } from 'react';

interface ViewerModalProps {
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  /** Clases del panel interior. */
  className: string;
  children: ReactNode;
}

/** Modal del visor: cierra al pulsar fuera del panel. */
export function ViewerModal({ dialogRef, onClose, className, children }: ViewerModalProps) {
  return (
    <div
      id="points-breakdown-modal"
      className="modal flex z-[999999]"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de porra"
      ref={dialogRef}
      tabIndex={-1}
      onClick={onClose}
    >
      <div className={className} role="presentation" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

interface ViewerMessageProps {
  inline: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  kind: 'error' | 'notFound';
  /** Detalle del error. */
  message?: string;
}

/** Aviso de porra no disponible o no encontrada, en la página o en el modal. */
export function ViewerMessage({ inline, dialogRef, onClose, kind, message }: ViewerMessageProps) {
  const body =
    kind === 'error' ? (
      <>
        <div className="text-[2.5rem] mb-3">🔒</div>
        <h3 className="text-[var(--miss)] mb-2.5">Porra no disponible</h3>
        <p className="text-muted leading-[1.5]">{message}</p>
      </>
    ) : (
      <>
        <div className="text-[2.5rem] mb-3">⚠️</div>
        <h3 className="text-main mb-2.5">Porra no encontrada</h3>
        <p className="text-muted">No se encontraron los datos de la porra seleccionada.</p>
      </>
    );

  if (inline) {
    return (
      <div
        className={
          kind === 'error'
            ? 'paper-panel album-sheet text-center py-10 px-5'
            : 'paper-panel album-sheet text-center py-10 px-5'
        }
      >
        {body}
      </div>
    );
  }
  return (
    <ViewerModal
      dialogRef={dialogRef}
      onClose={onClose}
      className="modal-content paper-panel album-sheet landing-tape w-[95vw] max-w-150 text-center p-8"
    >
      {body}
      <button onClick={onClose} className="glass-btn primary-btn mt-5">
        Cerrar
      </button>
    </ViewerModal>
  );
}
