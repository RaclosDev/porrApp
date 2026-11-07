import InkStamp from '../InkStamp';
import { Check, TriangleAlert } from 'lucide-react';
interface MatchdayHeaderProps {
  title: string;
  isLocked: boolean;
  /** Mientras cargan los partidos no se sabe cuántos hay: no se pinta un «0/0» falso. */
  isLoading: boolean;
  predicted: number;
  total: number;
  successMsg: string;
  errorMsg: string;
}

/**
 * Cabecera de la jornada con el progreso y los avisos del último guardado. Guardar es el botón
 * flotante, que solo aparece cuando hay cambios sin guardar.
 */
export default function MatchdayHeader({
  title,
  isLocked,
  isLoading,
  predicted,
  total,
  successMsg,
  errorMsg,
}: MatchdayHeaderProps) {
  return (
    <>
      <div className="md-page-header">
        <div className="min-w-0">
          <h1>{title}</h1>
          <p className="md-page-sub">
            {isLocked ? (
              <InkStamp>Porra cerrada</InkStamp>
            ) : isLoading ? (
              <span className="skeleton inline-block h-[0.9em] w-24 rounded" aria-hidden="true" />
            ) : (
              `${predicted}/${total} predicciones`
            )}
          </p>
        </div>
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
