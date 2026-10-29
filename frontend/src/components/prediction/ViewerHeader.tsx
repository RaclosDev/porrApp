import type { ViewerPrediction } from '../../utils/predictionData';
import { type ViewerData } from './viewerTypes';
interface ViewerHeaderProps {
  handleClose: () => void;
  inline: boolean;
  onEdit: (() => void) | null;
  part: ViewerPrediction;
  points: ViewerData['points'];
}

/** Cabecera del visor: nombre, total de puntos y acciones. */
export default function ViewerHeader({
  handleClose,
  inline,
  onEdit,
  part,
  points,
}: ViewerHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '10px',
        marginBottom: '15px',
        flexWrap: 'wrap',
        gap: '10px',
      }}
    >
      <h3
        style={{
          color: 'var(--accent-cyan, #00d2d3)',
          fontFamily: "'Outfit', sans-serif",
          fontSize: '1.25rem',
          fontWeight: 800,
          letterSpacing: '-0.3px',
          margin: 0,
        }}
      >
        Porra de {part.user}
      </h3>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {part.scorer && (
          <div
            style={{
              background: 'rgba(255,159,67,0.15)',
              border: '1px solid rgba(255,159,67,0.4)',
              padding: '4px 10px',
              borderRadius: '8px',
              color: '#ff9f43',
              fontWeight: 'bold',
              fontSize: '0.85rem',
            }}
          >
            ⚽ Pichichi: {part.scorer}
          </div>
        )}
        <div
          style={{
            background: 'rgba(0,210,211,0.12)',
            border: '1px solid rgba(0,210,211,0.4)',
            padding: '4px 10px',
            borderRadius: '8px',
            color: 'var(--accent-cyan, #00d2d3)',
            fontWeight: 800,
            fontSize: '0.95rem',
          }}
        >
          🏆 Total: {points.total} pts
        </div>
        {inline && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="glass-btn primary-btn"
            style={{
              padding: '5px 14px',
              fontSize: '0.88rem',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ✏️ Modificar Pronóstico
          </button>
        ) : !inline ? (
          <button
            type="button"
            onClick={handleClose}
            className="glass-btn"
            style={{
              padding: '5px 14px',
              fontSize: '0.88rem',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
            }}
          >
            ✕ Cerrar
          </button>
        ) : null}
      </div>
    </div>
  );
}
