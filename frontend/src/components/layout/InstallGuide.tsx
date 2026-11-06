import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Ellipsis, Share, SquarePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import DialogBackdrop from '../DialogBackdrop';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import {
  installState,
  shareButtonPlace,
  type ShareButtonPlace,
} from '../../services/installPrompt';
import { isIos } from '../../services/push';

interface InstallGuideProps {
  onClose: () => void;
  /** Por qué se pide instalar (p. ej. los avisos en iPhone solo llegan con la app instalada). */
  reason?: string;
}

const icon = (Icon: typeof Share, label?: string) => (
  <Icon
    size={16}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className="mx-0.5 inline align-[-3px]"
  />
);

/** Primer paso según dónde está «Compartir» en este navegador. */
const FIRST_STEP: Record<ShareButtonPlace, ReactNode> = {
  bottom: (
    <>
      Toca <strong>Compartir</strong> {icon(Share)} en la barra de abajo.
    </>
  ),
  'bottom-menu': (
    <>
      Toca {icon(Ellipsis, 'Más')} abajo a la derecha y luego <strong>Compartir</strong>.
    </>
  ),
  'top-right': (
    <>
      Toca <strong>Compartir</strong> {icon(Share)} arriba a la derecha.
    </>
  ),
  menu: (
    <>
      Abre el menú del navegador y toca <strong>Compartir</strong>.
    </>
  ),
};

async function copyLink(browser: string) {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success(`Enlace copiado: pégalo en ${browser}.`);
  } catch {
    toast(`Copia este enlace: ${window.location.href}`);
  }
}

/**
 * Guía para instalar la app donde el navegador no tiene un botón de instalar (iPhone, iPad) o no
 * deja instalar (navegador dentro de Instagram, Facebook…). Una flecha señala el botón que hay que
 * tocar, para que baste con seguirla.
 */
export default function InstallGuide({ onClose, reason }: InstallGuideProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onEscape: onClose });

  const inApp = installState() === 'in-app';
  // En los navegadores de otras apps, el menú para abrir fuera suele estar arriba a la derecha.
  const place: ShareButtonPlace = inApp ? 'top-right' : shareButtonPlace();
  const arrowAtTop = place === 'top-right';
  const browser = isIos() ? 'Safari' : 'tu navegador';

  const arrow =
    place === 'menu' ? null : (
      <span
        aria-hidden="true"
        data-testid="install-guide-arrow"
        className={`text-[var(--paper)] motion-safe:animate-bounce ${place === 'bottom' ? 'self-center' : 'mr-1 self-end'}`}
      >
        {arrowAtTop ? (
          <ArrowUp size={44} strokeWidth={2.5} />
        ) : (
          <ArrowDown size={44} strokeWidth={2.5} />
        )}
      </span>
    );

  return createPortal(
    <DialogBackdrop
      className={`fixed inset-0 z-[100001] flex flex-col gap-2 bg-[rgba(2,6,23,0.78)] px-3 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-[calc(env(safe-area-inset-bottom,0px)+8px)] ${arrowAtTop ? 'justify-start' : 'justify-end'}`}
      onDismiss={onClose}
    >
      {arrowAtTop && arrow}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
        className={`paper-panel album-sheet w-full max-w-[360px] rounded-[12px] p-4 ${arrowAtTop ? 'self-end' : 'self-center'}`}
      >
        <h3 id="install-guide-title" className="m-0 mb-2 text-[1rem] font-bold text-main">
          {inApp ? `Ábrela en ${browser}` : 'Añade porrApp a tu pantalla de inicio'}
        </h3>
        {reason && <p className="m-0 mb-2 text-[0.85rem] text-muted">{reason}</p>}

        {inApp ? (
          <p className="m-0 mb-3 text-[0.88rem] text-main">
            Desde el navegador de esta app no se puede instalar. Toca {icon(Ellipsis, 'Más')} arriba
            y elige <strong>Abrir en {isIos() ? 'Safari' : 'el navegador'}</strong>, o copia el
            enlace y pégalo en {browser}.
          </p>
        ) : (
          <ol className="m-0 mb-3 flex list-decimal flex-col gap-1.5 pl-5 text-[0.88rem] text-main">
            <li>{FIRST_STEP[place]}</li>
            <li>
              Elige <strong>Añadir a pantalla de inicio</strong> {icon(SquarePlus)} y toca{' '}
              <strong>Añadir</strong>.
            </li>
          </ol>
        )}

        <div className="flex flex-col gap-2">
          {inApp && (
            <button
              type="button"
              className="glass-btn primary-btn w-full rounded-[8px] px-3 py-2 font-bold"
              onClick={() => void copyLink(browser)}
            >
              Copiar enlace
            </button>
          )}
          <button
            type="button"
            className="glass-btn w-full rounded-[8px] px-3 py-2 font-bold"
            onClick={onClose}
          >
            {inApp ? 'Ahora no' : 'Entendido'}
          </button>
        </div>
      </div>
      {!arrowAtTop && arrow}
    </DialogBackdrop>,
    document.body,
  );
}
