import { useState } from 'react';
import { Download } from 'lucide-react';
import { useInstallState } from '../../hooks/useInstallState';
import { promptInstall } from '../../services/installPrompt';
import IosInstallDialog from './IosInstallDialog';

/**
 * Botón de la cabecera para instalar la app. En Android y Chrome de escritorio abre el diálogo del
 * navegador; en iPhone y iPad explica los pasos. No aparece si ya está instalada o no se puede.
 */
export default function InstallAppButton() {
  const state = useInstallState();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (state !== 'native' && state !== 'ios') return null;

  return (
    <>
      <button
        id="btn-install-app"
        type="button"
        onClick={() => (state === 'native' ? void promptInstall() : setShowIosSteps(true))}
        className="glass-btn header-icon-btn"
        title="Instalar porrApp"
        aria-label="Instalar porrApp"
        aria-haspopup={state === 'ios' ? 'dialog' : undefined}
      >
        <Download size={20} aria-hidden="true" />
      </button>
      {showIosSteps && <IosInstallDialog onClose={() => setShowIosSteps(false)} />}
    </>
  );
}
