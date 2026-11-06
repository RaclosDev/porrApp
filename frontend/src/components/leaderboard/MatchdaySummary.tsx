import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { displayRoundLabel } from '../../utils/matchday';
import type { MatchdayPoints } from '../../types/api';

interface MatchdaySummaryProps {
  matchday: MatchdayPoints;
  /** La jornada elegida en el selector, si la hay. */
  selected: MatchdayPoints | null | undefined;
  matchdays: MatchdayPoints[];
  selectedLabel: string | null;
  myPoints: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onSelect: (label: string) => void;
  onStep: (step: -1 | 1) => void;
}

/** Cabecera de la clasificación por jornadas: estado, selector y puntos propios. */
export default function MatchdaySummary({
  matchday,
  selected,
  matchdays,
  selectedLabel,
  myPoints,
  canGoPrev,
  canGoNext,
  onSelect,
  onStep,
}: MatchdaySummaryProps) {
  // Hora fijada al montar: basta para distinguir una jornada abierta de una en juego.
  const [now] = useState(() => Date.now());
  // «En juego» solo cuando ya ha empezado algún partido; antes, la jornada sigue abierta.
  const status = matchday.finished
    ? { text: 'Finalizada', tone: 'finished' }
    : matchday.date && new Date(matchday.date).getTime() > now
      ? { text: 'Abierta', tone: 'open' }
      : { text: 'En juego', tone: 'live' };

  return (
    <div className="lb-matchday-panel paper-panel album-sheet">
      <div className="lb-matchday-summary">
        <div className="lb-matchday-heading">
          <span className="lb-matchday-eyebrow">
            <CalendarDays size={14} aria-hidden="true" />
            {selected?.current ? 'Jornada actual' : 'Jornada seleccionada'}
          </span>
          <div className="lb-matchday-title-row">
            <strong className="lb-matchday-title">{displayRoundLabel(matchday.label)}</strong>
            <span className={`lb-matchday-status is-${status.tone}`}>{status.text}</span>
          </div>
          {matchday.matchCount > 0 && (
            <span className="lb-matchday-meta">
              {matchday.matchCount} {matchday.matchCount === 1 ? 'partido' : 'partidos'}
            </span>
          )}
        </div>
      </div>

      <div className="lb-matchday-nav">
        <button
          type="button"
          className="lb-matchday-step"
          onClick={() => onStep(-1)}
          disabled={!canGoPrev}
          aria-label="Jornada anterior"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        <select
          className="lb-matchday-select"
          value={selectedLabel || ''}
          onChange={(event) => onSelect(event.target.value)}
          aria-label="Seleccionar jornada"
        >
          {matchdays.map((option) => (
            <option key={option.label} value={option.label}>
              {displayRoundLabel(option.label)}
              {option.current ? ' · actual' : ''}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="lb-matchday-step"
          onClick={() => onStep(1)}
          disabled={!canGoNext}
          aria-label="Jornada siguiente"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="lb-matchday-footer">
        <span>
          Tus puntos en esta jornada <strong>{myPoints}</strong>
        </span>
        <Link to="/stats" aria-label="Estadísticas por partido">
          <BarChart3 size={16} aria-hidden="true" /> Estadísticas
        </Link>
      </div>
    </div>
  );
}
