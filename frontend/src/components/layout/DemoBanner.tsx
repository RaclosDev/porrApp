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
      className="sticky top-0 z-[110] flex items-center justify-between gap-2 bg-[var(--paper)] text-[var(--ink)] px-3 py-1.5 text-[0.8rem]"
    >
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <span className="truncate">
          <strong>Modo demo:</strong> Cuadro, resultados y participantes reales
        </span>
      </div>
      <div className="inline-flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowMyPredictionModal(true)}
          className="min-h-11 cursor-pointer whitespace-nowrap rounded-md border-none bg-[var(--ink)] px-3 py-1 text-xs font-extrabold text-[var(--paper)]"
        >
          Entrar con Google
        </button>
        <button
          type="button"
          onClick={() => {
            exitDemoMode?.();
            navigate('/', { replace: true });
          }}
          className="cursor-pointer whitespace-nowrap border-none bg-transparent min-h-11 px-3 py-0.5 text-xs text-[#4b5563] underline"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
