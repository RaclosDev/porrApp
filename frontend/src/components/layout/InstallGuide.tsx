import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Ellipsis, Menu, Share, SquarePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import DialogBackdrop from '../DialogBackdrop';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import {
  installState,
  shareButtonPlace,
  type ShareButtonPlace,
} from '../../services/installPrompt';
import { isIos } from '../../services/push';
import { prepareSessionHandoff } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

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
  'address-menu': (
    <>
      Toca {icon(Menu, 'Menú')} a la izquierda de la barra de dirección y luego{' '}
      <strong>Compartir</strong>.
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
 * En iPhone la app instalada no comparte la sesión de Safari: con sesión iniciada, se deja en una
 * cookie el código con el que la app abrirá la suya la primera vez. True cuando ya está listo.
 */
function useSessionHandoff(installingOnIos: boolean): boolean {
  const signedIn = useAppStore((state) => state.isAuthenticated && !state.isDemoMode);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!installingOnIos || !signedIn) return;
    let active = true;
    void prepareSessionHandoff().then((ok) => {
      if (active) setReady(ok);
    });
    return () => {
      active = false;
    };
  }, [installingOnIos, signedIn]);
  return ready;
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
  // La flecha baja hacia el botón: centrada, sobre el «≡» de la barra de dirección o a la derecha.
  const arrowPosition: Partial<Record<ShareButtonPlace, string>> = {
    bottom: 'self-center',
    'address-menu': 'self-start ml-[20%]',
  };
  const browser = isIos() ? 'Safari' : 'tu navegador';
  const keepsSession = useSessionHandoff(!inApp && installState() === 'ios');

  const arrow =
    place === 'menu' ? null : (
      <span
        aria-hidden="true"
        data-testid="install-guide-arrow"
        className={`text-[var(--paper)] motion-safe:animate-bounce ${arrowPosition[place] ?? 'mr-1 self-end'}`}
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
              {/* En Safari 27 la opción queda oculta tras «Ver más» en la hoja de Compartir. */}
              {place === 'address-menu' && (
                <>
                  Toca <strong>Ver más</strong>,{' '}
                </>
              )}
              {place === 'address-menu' ? 'elige' : 'Elige'}{' '}
              <strong>Añadir a pantalla de inicio</strong> {icon(SquarePlus)} y toca{' '}
              <strong>Añadir</strong>.
            </li>
          </ol>
        )}
        {keepsSession && (
          <p className="m-0 mb-3 text-[0.85rem] text-muted">
            Ábrela en los próximos 30 minutos y entrarás con tu cuenta sin volver a iniciar sesión.
          </p>
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
