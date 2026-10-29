import { TriangleAlert } from 'lucide-react';

interface LeaveConfirmDialogProps {
  onClose: () => void;
  setLeaveConfirmOpen: (open: boolean) => void;
}

/** Confirmación para cerrar el panel con cambios sin guardar. */
export default function LeaveConfirmDialog({
  onClose,
  setLeaveConfirmOpen,
}: LeaveConfirmDialogProps) {
  return (
    <div
      className="league-admin-confirm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="league-admin-leave-title"
    >
      <div className="league-admin-confirm-dialog">
        <span className="league-admin-confirm-icon">
          <TriangleAlert size={20} aria-hidden="true" />
        </span>
        <h3 id="league-admin-leave-title">¿Descartar los cambios?</h3>
        <p>Tienes cambios sin guardar en el nombre o en las reglas de la liga.</p>
        <div className="league-admin-confirm-actions">
          <button
            type="button"
            className="league-admin-btn is-ghost"
            onClick={() => setLeaveConfirmOpen(false)}
            autoFocus
          >
            Seguir editando
          </button>
          <button type="button" className="league-admin-btn is-danger" onClick={onClose}>
            Descartar y cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
