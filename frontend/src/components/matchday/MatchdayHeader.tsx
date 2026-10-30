import InkStamp from '../InkStamp';
import { Check, TriangleAlert } from 'lucide-react';
interface MatchdayHeaderProps {
  title: string;
  isLocked: boolean;
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
            {isLocked ? <InkStamp>Porra cerrada</InkStamp> : `${predicted}/${total} pronosticados`}
          </p>
        </div>

        <button
          onClick={onSave}
          disabled={isSaving || isLocked}
          className={`glass-btn primary-btn md-save-btn ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
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
