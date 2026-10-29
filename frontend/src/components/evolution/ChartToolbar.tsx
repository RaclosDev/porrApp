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
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px',
        marginBottom: '16px',
        padding: '0 4px',
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: '1.4rem',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📈 Gráfica de Evolución</span>
          {mode === 'rank' && (
            <span
              style={{
                fontSize: '0.8rem',
                background: 'rgba(0, 210, 211, 0.2)',
                color: '#00d2d3',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #00d2d3',
              }}
            >
              Ranking
            </span>
          )}
          {mode === 'points' && (
            <span
              style={{
                fontSize: '0.8rem',
                background: 'rgba(255, 159, 67, 0.2)',
                color: '#ff9f43',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #ff9f43',
              }}
            >
              Puntos
            </span>
          )}
        </h3>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Horizontal Zoom Controls */}
        <div
          style={{
            display: 'flex',
            gap: '2px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '3px',
            borderRadius: '25px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            alignItems: 'center',
          }}
        >
          <button
            onClick={() => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75))}
            disabled={zoomLevel <= 0.75}
            style={{
              padding: '5px 10px',
              borderRadius: '16px',
              border: 'none',
              cursor: zoomLevel <= 0.75 ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: zoomLevel <= 0.75 ? '#555' : '#fff',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
            title="Reducir zoom horizontal"
          >
            🔍-
          </button>
          <span
            style={{
              fontSize: '0.75rem',
              color: '#ccc',
              padding: '0 4px',
              fontWeight: 'bold',
              minWidth: '42px',
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((prev) => Math.min(prev + 0.35, 3.5))}
            disabled={zoomLevel >= 3.5}
            style={{
              padding: '5px 10px',
              borderRadius: '16px',
              border: 'none',
              cursor: zoomLevel >= 3.5 ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: zoomLevel >= 3.5 ? '#555' : '#fff',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
            title="Aumentar zoom horizontal"
          >
            🔍+
          </button>
          {zoomLevel !== 1 && (
            <button
              onClick={() => setZoomLevel(1)}
              style={{
                padding: '3px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '0.7rem',
                cursor: 'pointer',
                marginLeft: '2px',
                transition: 'all 0.2s',
              }}
              title="Restaurar zoom al 100%"
            >
              100%
            </button>
          )}
        </div>

        {/* Time Scale Selector */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: '25px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button
            onClick={() => {
              setTimeScale('rounds');
              setHoveredStageIdx(null);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              transition: 'all 0.2s',
              background: timeScale === 'rounds' ? '#70a1ff' : 'transparent',
              color: timeScale === 'rounds' ? '#000' : '#fff',
            }}
          >
            🔄 Rondas
          </button>
          <button
            onClick={() => {
              setTimeScale('matches');
              setHoveredStageIdx(null);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              transition: 'all 0.2s',
              background: timeScale === 'matches' ? '#2ecc71' : 'transparent',
              color: timeScale === 'matches' ? '#000' : '#fff',
            }}
          >
            ⏱️ Partido a Partido
          </button>
        </div>

        {/* Mode Selector */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '4px',
            borderRadius: '25px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button
            onClick={() => setMode('rank')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              transition: 'all 0.2s',
              background: mode === 'rank' ? '#00d2d3' : 'transparent',
              color: mode === 'rank' ? '#000' : '#fff',
            }}
          >
            🏆 Posición
          </button>
          <button
            onClick={() => setMode('points')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              transition: 'all 0.2s',
              background: mode === 'points' ? '#ff9f43' : 'transparent',
              color: mode === 'points' ? '#000' : '#fff',
            }}
          >
            📈 Puntos
          </button>
        </div>
      </div>
    </div>
  );
}
