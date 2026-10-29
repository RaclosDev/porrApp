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
    <div className="flex justify-between items-center border-b border-b-[rgba(255,255,255,0.1)] pb-2.5 mb-[15px] flex-wrap gap-2.5">
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
      <div className="flex gap-2.5 items-center flex-wrap">
        {part.scorer && (
          <div className="bg-[rgba(255,159,67,0.15)] border border-[rgba(255,159,67,0.4)] py-1 px-2.5 rounded-[8px] text-[#ff9f43] font-bold text-[0.85rem]">
            ⚽ Pichichi: {part.scorer}
          </div>
        )}
        <div className="bg-[rgba(0,210,211,0.12)] border border-[rgba(0,210,211,0.4)] py-1 px-2.5 rounded-[8px] text-cyan font-extrabold text-[0.95rem]">
          🏆 Total: {points.total} pts
        </div>
        {inline && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="glass-btn primary-btn py-[5px] px-3.5 text-[0.88rem] rounded-[8px] font-bold cursor-pointer flex items-center gap-1.5"
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
