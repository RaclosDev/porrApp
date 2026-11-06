import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis, Share, SquarePlus, Smartphone } from 'lucide-react';
import DialogBackdrop from '../DialogBackdrop';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface IosInstallDialogProps {
  onClose: () => void;
  /** Por qué se pide instalar (p. ej. los avisos en iPhone solo llegan con la app instalada). */
  reason?: string;
}

const STEPS = [
  {
    icon: Share,
    text: (
      <>
        Pulsa <strong>Compartir</strong> en la barra de Safari (si no lo ves, está en el menú{' '}
        <Ellipsis size={14} aria-label="Más" className="inline align-[-2px]" />
        ).
      </>
    ),
  },
  {
    icon: SquarePlus,
    text: (
      <>
        Elige <strong>Añadir a pantalla de inicio</strong> y confirma con <strong>Añadir</strong>.
      </>
    ),
  },
  {
    icon: Smartphone,
    text: <>Abre porrApp desde el icono que aparece en tu pantalla de inicio.</>,
  },
];

/** Pasos para instalar la app en iPhone y iPad, donde Safari no ofrece un botón de instalar. */
export default function IosInstallDialog({ onClose, reason }: IosInstallDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onEscape: onClose });

  return createPortal(
    <DialogBackdrop className="app-confirm-overlay" onDismiss={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="league-admin-confirm-dialog paper-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        aria-describedby={reason ? 'ios-install-reason' : undefined}
      >
        <h3 id="ios-install-title">Instala porrApp en tu iPhone</h3>
        {reason && <p id="ios-install-reason">{reason}</p>}
        <ol className="m-0 mb-4 flex list-none flex-col gap-3 p-0 text-left">
          {STEPS.map(({ icon: Icon, text }, index) => (
            <li key={index} className="flex items-center gap-3 text-[0.88rem] text-main">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ink)]"
              >
                <Icon size={18} />
              </span>
              <span>
                <span className="sr-only">Paso {index + 1}: </span>
                {text}
              </span>
            </li>
          ))}
        </ol>
        <div className="league-admin-confirm-actions">
          <button type="button" className="league-admin-btn" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
