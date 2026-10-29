import type { NavigateFunction } from 'react-router-dom';

interface DemoBannerProps {
  exitDemoMode: () => void;
  navigate: NavigateFunction;
  setShowMyPredictionModal: (show: boolean) => void;
}

/** Aviso flotante del modo demo. */
export default function DemoBanner({
  exitDemoMode,
  navigate,
  setShowMyPredictionModal,
}: DemoBannerProps) {
  return (
    <div
      id="demo-mode-banner"
      style={{
        background:
          'linear-gradient(90deg, rgba(0, 210, 211, 0.2) 0%, rgba(37, 99, 235, 0.22) 100%)',
        borderBottom: '1px solid rgba(0, 210, 211, 0.35)',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '0.8rem',
        color: '#f8fafc',
        position: 'sticky',
        top: 0,
        zIndex: 110,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: '0.9rem' }}>✨</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong>Modo Demo:</strong> Cuadro, resultados y participantes reales
        </span>
      </div>
      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setShowMyPredictionModal(true)}
          style={{
            background: 'var(--accent-cyan, #00d2d3)',
            color: '#0f172a',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontWeight: 800,
            fontSize: '0.75rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Jugar
        </button>
        <button
          type="button"
          onClick={() => {
            exitDemoMode?.();
            navigate('/', { replace: true });
          }}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: 'none',
            textDecoration: 'underline',
            fontSize: '0.75rem',
            cursor: 'pointer',
            padding: '2px 4px',
            whiteSpace: 'nowrap',
          }}
        >
          Salir
        </button>
      </div>
    </div>
  );
}
