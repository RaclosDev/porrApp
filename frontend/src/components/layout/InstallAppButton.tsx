import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useInstallState } from '../../hooks/useInstallState';
import { promptInstall } from '../../services/installPrompt';
import { PREDICTION_SAVED_EVENT } from '../../services/api';
import InstallGuide from './InstallGuide';

const SNOOZED_KEY = 'install_guide_snoozed_at';
/** Tras cerrar la guía, no se vuelve a ofrecer sola hasta pasadas dos semanas. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  const at = Number(localStorage.getItem(SNOOZED_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
}

/**
 * Botón de la cabecera para instalar la app. En Android y Chrome de escritorio abre el diálogo del
 * navegador; en iPhone y iPad (o dentro del navegador de otra app) abre una guía que señala qué
 * tocar. Esa guía también sale sola tras guardar una predicción. No aparece si ya está instalada.
 */
export default function InstallAppButton() {
  const state = useInstallState();
  const [showGuide, setShowGuide] = useState(false);
  const needsGuide = state === 'ios' || state === 'in-app';

  useEffect(() => {
    if (!needsGuide) return;
    const offerAfterSaving = () => {
      if (!snoozed()) setShowGuide(true);
    };
    window.addEventListener(PREDICTION_SAVED_EVENT, offerAfterSaving);
    return () => window.removeEventListener(PREDICTION_SAVED_EVENT, offerAfterSaving);
  }, [needsGuide]);

  if (state !== 'native' && !needsGuide) return null;

  const closeGuide = () => {
    localStorage.setItem(SNOOZED_KEY, String(Date.now()));
    setShowGuide(false);
  };

  return (
    <>
      <button
        id="btn-install-app"
        type="button"
        onClick={() => (state === 'native' ? void promptInstall() : setShowGuide(true))}
        className="glass-btn header-icon-btn"
        title="Instalar porrApp"
        aria-label="Instalar porrApp"
        aria-haspopup={needsGuide ? 'dialog' : undefined}
      >
        <Download size={20} aria-hidden="true" />
      </button>
      {showGuide && <InstallGuide onClose={closeGuide} />}
    </>
  );
}
