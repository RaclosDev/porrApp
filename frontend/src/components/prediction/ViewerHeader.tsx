import type { ViewerPrediction } from '../../utils/predictionData';
import { UserAvatar } from '../Avatar';
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
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="sticker-frame shrink-0">
          <UserAvatar url={points.avatarUrl} userId={points.userId} name={part.user} size={32} />
        </span>
        <h3 className="poster-title text-white text-[1.4rem] m-0 min-w-0 break-words">
          Porra de <span className="marker-ink">{part.user}</span>
        </h3>
      </div>
      <div className="flex gap-2.5 items-center flex-wrap">
        {part.scorer && (
          <div className="bg-[rgba(255,159,67,0.15)] bg-none border border-[rgba(255,159,67,0.4)] py-1 px-2.5 rounded-[8px] text-[#ff9f43] font-bold text-[0.85rem]">
            Pichichi: {part.scorer}
          </div>
        )}
        <span className="marker-ink text-[1.2rem]" aria-label={`${points.total} puntos en total`}>
          {points.total} pts
        </span>
        {inline && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="glass-btn primary-btn py-[5px] px-3.5 text-[0.88rem] rounded-[8px] font-bold cursor-pointer flex items-center gap-1.5"
          >
            Editar porra
          </button>
        ) : !inline ? (
          <button
            type="button"
            onClick={handleClose}
            className="glass-btn py-[5px] px-3.5 text-[0.88rem] rounded-[8px] font-bold cursor-pointer border border-[rgba(255,_255,_255,_0.2)] bg-[rgba(255,_255,_255,_0.08)] bg-none text-white"
          >
            Cerrar
          </button>
        ) : null}
      </div>
    </div>
  );
}
