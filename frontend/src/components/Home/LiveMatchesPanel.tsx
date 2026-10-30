import Flag from '../Flag';
import { openStats } from '../../utils/navigation';
import type { Match, MatchRadar } from '../../types/api';

interface LiveMatchesPanelProps {
  liveMatches: Match[];
  matchRadar: MatchRadar | null | undefined;
  maxNext?: number;
}

function LiveMatchesPanel({ liveMatches, matchRadar, maxNext = 1 }: LiveMatchesPanelProps) {
  const renderLiveMatch = (m: Match) => {
    const d = new Date(m.date ?? 0);
    const dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const hasStarted = new Date() >= d;
    const isPlaceholder = (t: string | null | undefined) =>
      !t ||
      t.toLowerCase().includes('por definir') ||
      t.toLowerCase().includes('tbd') ||
      t.includes('º') ||
      t === '?';
    const showStatsButton = m.home && m.away && !isPlaceholder(m.home) && !isPlaceholder(m.away);

    return (
      <div key={m.id} className="last-match-card">
        <div className="last-match-date">
          {hasStarted ? '🔴' : '🕒'} {hasStarted ? m.displayClock || 'EN JUEGO' : dateFormatted}
        </div>
        <div className="last-match-teams my-auto mx-0">
          <div className="last-match-team">
            <Flag team={m.home} logo={m.homeLogo || m.homeTeamLogo} />
            <span>{m.home}</span>
          </div>

          <div className="last-match-center flex flex-col items-center">
            {hasStarted && m.homeScore !== null && m.awayScore !== null ? (
              <span className="last-match-score">
                {m.homeScore} - {m.awayScore}
              </span>
            ) : (
              <span className="text-[0.9em] text-muted font-bold">VS</span>
            )}
          </div>

          <div className="last-match-team away">
            <Flag team={m.away} logo={m.awayLogo || m.awayTeamLogo} />
            <span>{m.away}</span>
          </div>
        </div>

        {showStatsButton && (
          <div className="text-center">
            <button
              className="bg-[#1e272e] bg-none text-[#00d2d3] border border-[rgba(0,210,211,0.3)] rounded-[8px] min-h-11 py-2.5 px-4.5 text-[0.9rem] font-bold cursor-pointer inline-flex items-center justify-center gap-[5px] shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
              onClick={() => openStats()}
            >
              Ver en Sofascore
            </button>
          </div>
        )}
      </div>
    );
  };

  const nextMatches = (matchRadar?.next || [])
    .filter((m) => !liveMatches.some((live) => live.id === m.id))
    .slice(0, maxNext);
  const hasLive = liveMatches && liveMatches.length > 0;
  const isActuallyLive = hasLive && liveMatches.some((m) => new Date(m.date ?? 0) <= new Date());

  if (!hasLive && nextMatches.length === 0) {
    return (
      <div
        className="glass-panel w-full max-w-120 mt-0 mb-5 mx-auto p-6 text-center text-muted rounded-[12px]"
        role="status"
      >
        <div className="text-[1.6rem] mb-2" aria-hidden="true">
          📅
        </div>
        <p className="m-0 font-bold text-[color:var(--text-primary,_#fff)]">
          No hay próximos partidos
        </p>
        <p className="mt-2 mb-0 mx-0 text-[0.9rem]">
          La competición puede haber terminado o el calendario todavía no estar disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-120 mt-0 mb-5 mx-auto flex flex-col gap-4">
      {hasLive && (
        <div className="flex flex-col gap-2">
          <div
            className={
              isActuallyLive
                ? 'text-center text-[#ff4757] text-[1rem] font-bold p-1.5 bg-[rgba(255,_71,_87,_0.1)] bg-none border border-[rgba(255,_71,_87,_0.3)] rounded-[12px]'
                : 'text-center text-[#00d2d3] text-[1rem] font-bold p-1.5 bg-[rgba(0,_210,_211,_0.08)] bg-none border border-[rgba(0,_210,_211,_0.3)] rounded-[12px]'
            }
          >
            {isActuallyLive ? '🔴 En directo' : 'A punto de empezar'}
          </div>
          <div className="last-matches-grid grid-cols-[1fr] gap-2.5">
            {liveMatches.map((m) => renderLiveMatch(m))}
          </div>
        </div>
      )}

      {nextMatches.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-center text-[#00d2d3] text-[1rem] font-bold p-1.5 bg-[rgba(0,_210,_211,_0.08)] bg-none border border-[rgba(0,_210,_211,_0.3)] rounded-[12px]">
            {nextMatches.length === 1 ? 'Próximo partido' : 'Próximos partidos'}
          </div>
          <div className="last-matches-grid grid-cols-[1fr] gap-2.5">
            {nextMatches.map((m) => renderLiveMatch(m))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveMatchesPanel;
