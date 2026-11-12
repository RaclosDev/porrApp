import { useRef } from 'react';
import DialogBackdrop from './DialogBackdrop';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { answerConfirm, useConfirmStore } from '../utils/confirmAction';

/** Confirmación de acciones que no se pueden deshacer; se abre con `confirmAction()`. */
export default function ConfirmDialog() {
  const request = useConfirmStore((state) => state.request);
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus(dialogRef, { active: request !== null, onEscape: () => answerConfirm(false) });

  if (!request) return null;

  return createPortal(
    <DialogBackdrop className="app-confirm-overlay" onDismiss={() => answerConfirm(false)}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="league-admin-confirm-dialog paper-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-message"
      >
        <span className="league-admin-confirm-icon">
          <TriangleAlert size={20} aria-hidden="true" />
        </span>
        <h3 id="app-confirm-title">{request.title}</h3>
        <p id="app-confirm-message">{request.message}</p>
        {request.details && request.details.length > 0 && (
          <ul className="app-confirm-details">
            {request.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <div className="league-admin-confirm-actions">
          <button
            type="button"
            className="league-admin-btn is-ghost"
            onClick={() => answerConfirm(false)}
          >
            {request.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            className="league-admin-btn is-danger"
            onClick={() => answerConfirm(true)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
