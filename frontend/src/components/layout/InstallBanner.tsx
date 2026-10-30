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
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid var(--accent-color)',
        borderRadius: '12px',
        padding: '15px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 10px 30px rgba(0,210,211,0.3)',
        zIndex: 999999,
        backdropFilter: 'blur(10px)',
        width: '90%',
        maxWidth: '350px',
      }}
    >
      <p style={{ margin: 0, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
        {isIos()
          ? 'Para instalar la app, pulsa Compartir y luego "Añadir a la pantalla de inicio".'
          : 'Para instalar la app, toca los 3 puntos de tu navegador y selecciona "Instalar aplicación", o pulsa abajo.'}
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
        {!isIos() && (
          <button
            onClick={handleInstallClick}
            className="glass-btn"
            style={{
              background: 'var(--accent-color)',
              color: 'black',
              fontWeight: 'bold',
              padding: '8px 15px',
            }}
          >
            Sí, Instalar
          </button>
        )}
        <button onClick={handleDismissBanner} className="glass-btn" style={{ padding: '8px 15px' }}>
          {isIos() ? 'Entendido' : 'No, gracias'}
        </button>
      </div>
    </div>
  );
}
