import type { ReactNode } from 'react';

interface DialogBackdropProps {
  id?: string;
  /** Clase del fondo (`paper-dialog-overlay`, `league-admin-overlay`…). */
  className: string;
  /** Se llama al pulsar el fondo, fuera del panel. */
  onDismiss: () => void;
  /** El panel, que lleva `role="dialog"`, `aria-modal` y el foco (useDialogFocus). */
  children: ReactNode;
}

/**
 * Fondo de un diálogo modal. Pulsar fuera del panel lo cierra; es un atajo de ratón, con teclado
 * se cierra con Escape (useDialogFocus). El fondo es presentación: el diálogo es el panel.
 */
export default function DialogBackdrop({
  id,
  className,
  onDismiss,
  children,
}: DialogBackdropProps) {
  return (
    <div
      id={id}
      className={className}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      {children}
    </div>
  );
}
