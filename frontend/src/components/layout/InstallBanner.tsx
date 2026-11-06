interface InstallBannerProps {
  handleDismissBanner: () => void;
  handleInstallClick: () => void;
}

/**
 * Aviso para instalar la app donde el navegador tiene su propio diálogo (Android, Chrome de
 * escritorio). En iPhone lo sustituye la guía de InstallAppButton, que sale tras una predicción.
 */
export default function InstallBanner({
  handleDismissBanner,
  handleInstallClick,
}: InstallBannerProps) {
  return (
    <div className="paper-panel album-sheet landing-tape fixed bottom-5 left-1/2 z-[999999] flex w-[90%] max-w-[350px] -translate-x-1/2 flex-col items-center gap-2.5 rounded-[4px] border border-[var(--ink)] px-5 py-[15px] shadow-[4px_4px_0_rgba(0,0,0,0.2)]">
      <p className="m-0 text-center font-bold text-main">
        Instala porrApp para abrirla con un toque y recibir avisos antes de que cierren tus
        predicciones.
      </p>
      <div className="mt-[5px] flex gap-2.5">
        <button
          onClick={handleInstallClick}
          className="glass-btn primary-btn px-[15px] py-2 font-bold text-main"
        >
          Instalar
        </button>
        <button onClick={handleDismissBanner} className="glass-btn px-[15px] py-2">
          No, gracias
        </button>
      </div>
    </div>
  );
}
