import type { Match } from '../../types/api';
import type { SwissDay } from '../../utils/officialTournament';
import { officialMatchWinner } from '../../utils/officialTournament';
import Flag from '../Flag';

const timeFormat = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
});

interface SwissMatchesProps {
  days: SwissDay[];
  logos: Record<string, string>;
}

function SwissMatchRow({ match, logos }: { match: Match; logos: Record<string, string> }) {
  const winner = officialMatchWinner(match);
  const hasScore = match.homeScore != null && match.awayScore != null;
  const live = !match.finished && hasScore;
  const team = (name: string, side: 'home' | 'away') => (
    <span
      className={`flex items-center gap-1.5 min-w-0 ${side === 'home' ? 'justify-end text-right' : ''} ${winner === name ? 'font-bold' : ''} ${winner && winner !== name ? 'text-muted' : ''}`}
    >
      {side === 'away' && <Flag team={name} logo={logos[name]} />}
      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{name}</span>
      {side === 'home' && <Flag team={name} logo={logos[name]} />}
    </span>
  );
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-1.5 px-2 rounded-[6px] text-[0.9em]">
      {team(match.home, 'home')}
      <span
        className={`min-w-12 text-center tabular-nums font-bold ${live ? 'text-[var(--hit)]' : ''}`}
      >
        {hasScore ? (
          <>
            {match.homeScore}–{match.awayScore}
            {live && <span className="sr-only"> en juego</span>}
          </>
        ) : (
          <span className="font-normal text-muted">
            {match.date ? timeFormat.format(new Date(match.date)) : 'Por fijar'}
          </span>
        )}
      </span>
      {team(match.away, 'away')}
    </li>
  );
}

/** Enfrentamientos de la fase suiza, agrupados por día. */
export default function SwissMatches({ days, logos }: SwissMatchesProps) {
  return (
    <div className="paper-panel album-sheet p-4">
      <h2 className="album-sheet-title mb-2.5 text-left">Enfrentamientos</h2>
      {days.map((day) => (
        <section key={day.key} aria-label={day.label} className="mb-2 last:mb-0">
          <h3 className="m-0 mb-1 text-[0.75em] font-bold uppercase tracking-wide text-muted">
            {day.label}
          </h3>
          <ul className="m-0 p-0 list-none">
            {day.matches.map((match) => (
              <SwissMatchRow key={match.id} match={match} logos={logos} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
