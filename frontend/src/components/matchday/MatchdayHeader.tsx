import InkStamp from '../InkStamp';
import { Check, TriangleAlert } from 'lucide-react';
interface MatchdayHeaderProps {
  title: string;
  isLocked: boolean;
  /** Queda algún partido abierto; si no, no hay nada que guardar y el botón no se muestra. */
  canEdit: boolean;
  predicted: number;
  total: number;
  isSaving: boolean;
  onSave: () => void;
  successMsg: string;
  errorMsg: string;
}

/** Cabecera de la jornada con el botón de guardar y los avisos del último guardado. */
export default function MatchdayHeader({
  title,
  isLocked,
  canEdit,
  predicted,
  total,
  isSaving,
  onSave,
  successMsg,
  errorMsg,
}: MatchdayHeaderProps) {
  return (
    <>
      <div className="md-page-header">
        <div className="min-w-0">
          <h1>{title}</h1>
          <p className="md-page-sub">
            {isLocked ? <InkStamp>Porra cerrada</InkStamp> : `${predicted}/${total} predicciones`}
          </p>
        </div>

        {canEdit && !isLocked && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="glass-btn primary-btn md-save-btn cursor-pointer"
          >
            {isSaving ? 'Guardando…' : 'Guardar'}
          </button>
        )}
      </div>

      {successMsg && (
        <div className="md-save-notice" role="status" aria-live="polite">
          <Check size={18} aria-hidden="true" /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="md-save-notice is-error" role="alert">
          <TriangleAlert size={18} aria-hidden="true" /> {errorMsg}
        </div>
      )}
    </>
  );
}
