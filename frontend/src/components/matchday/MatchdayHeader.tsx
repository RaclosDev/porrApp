import InkStamp from '../InkStamp';
import { Check, TriangleAlert } from 'lucide-react';
import type { SaveStatus } from '../../hooks/useMatchdayPredictor';

interface MatchdayHeaderProps {
  title: string;
  isLocked: boolean;
  /** Mientras cargan los partidos no se sabe cuántos hay: no se pinta un «0/0» falso. */
  isLoading: boolean;
  predicted: number;
  total: number;
  saveStatus: SaveStatus;
  errorMsg: string;
  onRetry: () => void;
}

/**
 * Cabecera de la jornada: progreso y estado del guardado. Cada signo se guarda al elegirlo,
 * así que no hay botón de guardar; si falla, se ofrece reintentar.
 */
export default function MatchdayHeader({
  title,
  isLocked,
  isLoading,
  predicted,
  total,
  saveStatus,
  errorMsg,
  onRetry,
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
              <>
                {predicted}/{total} predicciones
                <span className="md-save-status" role="status" aria-live="polite">
                  {saveStatus === 'saving' && ' · Guardando…'}
                  {saveStatus === 'saved' && (
                    <>
                      {' · '}
                      <Check size={13} aria-hidden="true" /> Guardado
                    </>
                  )}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {saveStatus === 'error' && errorMsg && (
        <div className="md-save-notice is-error" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span className="min-w-0 flex-1">{errorMsg}</span>
          <button type="button" className="md-save-retry" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      )}
    </>
  );
}
