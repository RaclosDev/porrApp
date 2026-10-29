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
        <h3 className="m-0 text-[1.4rem] text-white flex items-center gap-2">
          <span>📈 Gráfica de Evolución</span>
          {mode === 'rank' && (
            <span className="text-[0.8rem] bg-[rgba(0,_210,_211,_0.2)] text-[#00d2d3] py-0.5 px-2 rounded-[12px] border border-[#00d2d3]">
              Ranking
            </span>
          )}
          {mode === 'points' && (
            <span className="text-[0.8rem] bg-[rgba(255,_159,_67,_0.2)] text-[#ff9f43] py-0.5 px-2 rounded-[12px] border border-[#ff9f43]">
              Puntos
            </span>
          )}
        </h3>
      </div>

      <div className="flex gap-2.5 flex-wrap items-center">
        {/* Horizontal Zoom Controls */}
        <div className="flex gap-0.5 bg-[rgba(255,_255,_255,_0.04)] p-[3px] rounded-[25px] border border-[rgba(255,_255,_255,_0.1)] items-center">
          <button
            className={`py-[5px] px-2.5 rounded-[16px] border-none bg-transparent font-bold text-[0.9rem] [transition:all_0.2s] ${zoomLevel <= 0.75 ? 'cursor-not-allowed' : 'cursor-pointer'} ${zoomLevel <= 0.75 ? 'text-[#555]' : 'text-white'}`}
            onClick={() => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75))}
            disabled={zoomLevel <= 0.75}
            title="Reducir zoom horizontal"
          >
            🔍-
          </button>
          <span className="text-[0.75rem] text-[#ccc] py-0 px-1 font-bold min-w-10.5 text-center select-none">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            className={`py-[5px] px-2.5 rounded-[16px] border-none bg-transparent font-bold text-[0.9rem] [transition:all_0.2s] ${zoomLevel >= 3.5 ? 'cursor-not-allowed' : 'cursor-pointer'} ${zoomLevel >= 3.5 ? 'text-[#555]' : 'text-white'}`}
            onClick={() => setZoomLevel((prev) => Math.min(prev + 0.35, 3.5))}
            disabled={zoomLevel >= 3.5}
            title="Aumentar zoom horizontal"
          >
            🔍+
          </button>
          {zoomLevel !== 1 && (
            <button
              className="py-[3px] px-2 rounded-[12px] border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.1)] text-white text-[0.7rem] cursor-pointer ml-0.5 [transition:all_0.2s]"
              onClick={() => setZoomLevel(1)}
              title="Restaurar zoom al 100%"
            >
              100%
            </button>
          )}
        </div>

        {/* Time Scale Selector */}
        <div className="flex gap-1 bg-[rgba(255,_255,_255,_0.04)] p-1 rounded-[25px] border border-[rgba(255,_255,_255,_0.1)]">
          <button
            className={`py-1.5 px-3.5 rounded-[20px] border-none cursor-pointer font-bold text-[0.8rem] [transition:all_0.2s] ${timeScale === 'rounds' ? 'bg-[#70a1ff]' : 'bg-transparent'} ${timeScale === 'rounds' ? 'text-black' : 'text-white'}`}
            onClick={() => {
              setTimeScale('rounds');
              setHoveredStageIdx(null);
            }}
          >
            🔄 Rondas
          </button>
          <button
            className={`py-1.5 px-3.5 rounded-[20px] border-none cursor-pointer font-bold text-[0.8rem] [transition:all_0.2s] ${timeScale === 'matches' ? 'bg-[#2ecc71]' : 'bg-transparent'} ${timeScale === 'matches' ? 'text-black' : 'text-white'}`}
            onClick={() => {
              setTimeScale('matches');
              setHoveredStageIdx(null);
            }}
          >
            ⏱️ Partido a Partido
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-1 bg-[rgba(255,_255,_255,_0.05)] p-1 rounded-[25px] border border-[rgba(255,_255,_255,_0.1)]">
          <button
            className={`py-1.5 px-4 rounded-[20px] border-none cursor-pointer font-bold text-[0.85rem] [transition:all_0.2s] ${mode === 'rank' ? 'bg-[#00d2d3]' : 'bg-transparent'} ${mode === 'rank' ? 'text-black' : 'text-white'}`}
            onClick={() => setMode('rank')}
          >
            🏆 Posición
          </button>
          <button
            className={`py-1.5 px-4 rounded-[20px] border-none cursor-pointer font-bold text-[0.85rem] [transition:all_0.2s] ${mode === 'points' ? 'bg-[#ff9f43]' : 'bg-transparent'} ${mode === 'points' ? 'text-black' : 'text-white'}`}
            onClick={() => setMode('points')}
          >
            📈 Puntos
          </button>
        </div>
      </div>
    </div>
  );
}
