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
      className="sticky top-0 z-[110] flex items-center justify-between gap-2 border-b border-cyan/35 bg-gradient-to-r from-cyan/20 to-accent/20 px-3 py-1.5 text-[0.8rem] text-main backdrop-blur-sm"
    >
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <span className="text-[0.9rem]">✨</span>
        <span className="truncate">
          <strong>Modo Demo:</strong> Cuadro, resultados y participantes reales
        </span>
      </div>
      <div className="inline-flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowMyPredictionModal(true)}
          className="cursor-pointer whitespace-nowrap rounded-md border-none bg-cyan px-2.5 py-1 text-xs font-extrabold text-app"
        >
          Jugar
        </button>
        <button
          type="button"
          onClick={() => {
            exitDemoMode?.();
            navigate('/', { replace: true });
          }}
          className="cursor-pointer whitespace-nowrap border-none bg-transparent px-1 py-0.5 text-xs text-muted underline"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
