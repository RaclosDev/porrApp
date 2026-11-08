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
  /** Tu puesto en la jornada; null mientras nadie ha puntuado. */
  myRank: number | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  onSelect: (label: string) => void;
  onStep: (step: -1 | 1) => void;
  /** Liga de la UFC: cada jornada es una velada de peleas. */
  fightCard?: boolean;
}

/** Cabecera de la clasificación por jornadas: estado, tus puntos y puesto, y selector. */
export default function MatchdaySummary({
  matchday,
  selected,
  matchdays,
  selectedLabel,
  myPoints,
  myRank,
  canGoPrev,
  canGoNext,
  onSelect,
  onStep,
  fightCard = false,
}: MatchdaySummaryProps) {
  // La UFC va por veladas de peleas; la NFL (y las ligas de varias competiciones), por semanas: «Semana 9».
  const round = fightCard ? 'Velada' : /^Semana \d/.test(matchday.label) ? 'Semana' : 'Jornada';
  const items = fightCard ? ['pelea', 'peleas'] : ['partido', 'partidos'];
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
            {`${round} ${selected?.current ? 'actual' : 'seleccionada'}`}
          </span>
          <strong className="lb-matchday-title">{displayRoundLabel(matchday.label)}</strong>
          <div className="lb-matchday-title-row">
            <span className={`lb-matchday-status is-${status.tone}`}>{status.text}</span>
            {matchday.matchCount > 0 && (
              <span className="lb-matchday-meta">
                {matchday.matchCount} {matchday.matchCount === 1 ? items[0] : items[1]}
              </span>
            )}
          </div>
        </div>
        <div className="lb-matchday-aside">
          <span
            className="lb-matchday-me"
            aria-label={`Tus puntos en esta ${round.toLowerCase()}: ${myPoints}${myRank ? `, puesto ${myRank}` : ''}`}
          >
            <strong>{myPoints}</strong> pts
            {myRank && <span className="lb-matchday-rank">{myRank}º</span>}
          </span>
          <Link
            to="/stats"
            className="lb-matchday-stats"
            aria-label="Estadísticas por partido"
            title="Estadísticas por partido"
          >
            <BarChart3 size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="lb-matchday-nav">
        <button
          type="button"
          className="lb-matchday-step"
          onClick={() => onStep(-1)}
          disabled={!canGoPrev}
          aria-label={`${round} anterior`}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        <select
          className="lb-matchday-select"
          value={selectedLabel || ''}
          onChange={(event) => onSelect(event.target.value)}
          aria-label={`Seleccionar ${round.toLowerCase()}`}
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
          aria-label={`${round} siguiente`}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
