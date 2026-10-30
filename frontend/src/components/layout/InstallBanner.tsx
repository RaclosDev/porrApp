interface InstallBannerProps {
  handleDismissBanner: () => void;
  handleInstallClick: () => void;
  isIos: () => boolean;
}

/** Aviso para instalar la app (PWA). */
export default function InstallBanner({
  handleDismissBanner,
  handleInstallClick,
  isIos,
}: InstallBannerProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-[999999] flex w-[90%] max-w-[350px] -translate-x-1/2 flex-col items-center gap-2.5 rounded-xl border border-accent bg-app/95 px-5 py-[15px] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      <p className="m-0 text-center font-bold text-white">
        {isIos()
          ? 'Para instalar la app, pulsa Compartir y luego "Añadir a la pantalla de inicio".'
          : 'Para instalar la app, toca los 3 puntos de tu navegador y selecciona "Instalar aplicación", o pulsa abajo.'}
      </p>
      <div className="mt-[5px] flex gap-2.5">
        {!isIos() && (
          <button
            onClick={handleInstallClick}
            className="glass-btn bg-accent px-[15px] py-2 font-bold text-white"
          >
            Instalar
          </button>
        )}
        <button onClick={handleDismissBanner} className="glass-btn px-[15px] py-2">
          {isIos() ? 'Entendido' : 'No, gracias'}
        </button>
      </div>
    </div>
  );
}
