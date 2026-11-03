import type { Dispatch, SetStateAction } from 'react';
import type { TimeScale } from './evolutionData';
interface ChartToolbarProps {
  mode: 'rank' | 'points';
  setMode: (mode: 'rank' | 'points') => void;
  timeScale: TimeScale;
  setTimeScale: (scale: TimeScale) => void;
  zoomLevel: number;
  setZoomLevel: Dispatch<SetStateAction<number>>;
  setHoveredStageIdx: (idx: number | null) => void;
}

const toggleClass = (active: boolean) =>
  `rounded-[20px] border-none cursor-pointer font-bold [transition:all_0.2s] min-h-11 sm:min-h-0 ${active ? 'bg-[var(--ink)] bg-none text-[var(--paper)]' : 'bg-transparent bg-none text-main'}`;

/** Título y controles del gráfico: zoom, escala temporal y modo. */
export default function ChartToolbar({
  mode,
  setMode,
  timeScale,
  setTimeScale,
  zoomLevel,
  setZoomLevel,
  setHoveredStageIdx,
}: ChartToolbarProps) {
  return (
    <div className="flex justify-between items-center flex-wrap gap-[15px] mb-4 py-0 px-1">
      <div>
        <h3 className="m-0 text-[1.4rem] text-main flex items-center gap-2">
          <span>Evolución de la clasificación</span>
        </h3>
      </div>

      <div className="flex gap-2.5 flex-wrap items-center">
        <div className="flex gap-0.5 bg-[rgba(17,_24,_39,_0.04)] bg-none p-[3px] rounded-[25px] border border-[rgba(17,_24,_39,_0.1)] items-center">
          <button
            type="button"
            className={`py-[5px] px-2.5 rounded-[16px] border-none bg-transparent bg-none font-bold text-[0.9rem] [transition:all_0.2s] min-h-11 sm:min-h-0 ${zoomLevel <= 0.75 ? 'cursor-not-allowed' : 'cursor-pointer'} ${zoomLevel <= 0.75 ? 'text-muted' : 'text-main'}`}
            onClick={() => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75))}
            disabled={zoomLevel <= 0.75}
            title="Reducir zoom horizontal"
            aria-label="Reducir zoom"
          >
            🔍-
          </button>
          <span className="text-[0.75rem] text-muted py-0 px-1 font-bold min-w-10.5 text-center select-none">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            className={`py-[5px] px-2.5 rounded-[16px] border-none bg-transparent bg-none font-bold text-[0.9rem] [transition:all_0.2s] min-h-11 sm:min-h-0 ${zoomLevel >= 3.5 ? 'cursor-not-allowed' : 'cursor-pointer'} ${zoomLevel >= 3.5 ? 'text-muted' : 'text-main'}`}
            onClick={() => setZoomLevel((prev) => Math.min(prev + 0.35, 3.5))}
            disabled={zoomLevel >= 3.5}
            title="Aumentar zoom horizontal"
            aria-label="Aumentar zoom"
          >
            🔍+
          </button>
          {zoomLevel !== 1 && (
            <button
              type="button"
              className="py-[3px] px-2 rounded-[12px] border border-[rgba(17,24,39,0.2)] bg-[rgba(17,24,39,0.1)] bg-none text-main text-[0.7rem] cursor-pointer ml-0.5 [transition:all_0.2s] min-h-11 sm:min-h-0"
              onClick={() => setZoomLevel(1)}
              title="Restaurar zoom al 100%"
              aria-label="Restaurar zoom al 100%"
            >
              100%
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-[rgba(17,_24,_39,_0.04)] bg-none p-1 rounded-[25px] border border-[rgba(17,_24,_39,_0.1)]">
          <button
            type="button"
            className={`py-1.5 px-3.5 text-[0.8rem] ${toggleClass(timeScale === 'rounds')}`}
            aria-pressed={timeScale === 'rounds'}
            onClick={() => {
              setTimeScale('rounds');
              setHoveredStageIdx(null);
            }}
          >
            Por rondas
          </button>
          <button
            type="button"
            className={`py-1.5 px-3.5 text-[0.8rem] ${toggleClass(timeScale === 'matches')}`}
            aria-pressed={timeScale === 'matches'}
            onClick={() => {
              setTimeScale('matches');
              setHoveredStageIdx(null);
            }}
          >
            Partido a partido
          </button>
        </div>

        <div className="flex gap-1 bg-[rgba(17,_24,_39,_0.05)] bg-none p-1 rounded-[25px] border border-[rgba(17,_24,_39,_0.1)]">
          <button
            type="button"
            className={`py-1.5 px-4 text-[0.85rem] ${toggleClass(mode === 'rank')}`}
            aria-pressed={mode === 'rank'}
            onClick={() => setMode('rank')}
          >
            Posición
          </button>
          <button
            type="button"
            className={`py-1.5 px-4 text-[0.85rem] ${toggleClass(mode === 'points')}`}
            aria-pressed={mode === 'points'}
            onClick={() => setMode('points')}
          >
            Puntos
          </button>
        </div>
      </div>
    </div>
  );
}
