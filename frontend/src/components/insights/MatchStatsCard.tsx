import Flag from '../Flag';
import type { MatchStats } from '../../types/api';
import { realSign, signShares, type Sign } from '../../utils/matchdayStats';

const SIGN_STYLE: Record<Sign, { bar: string; label: string }> = {
  '1': { bar: 'bg-cyan', label: 'Gana local' },
  X: { bar: 'bg-[#94a3b8]', label: 'Empate' },
  '2': { bar: 'bg-accent-text', label: 'Gana visitante' },
};

const kickoff = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function Team({
  name,
  logo,
  align,
}: {
  name: string;
  logo: string | null;
  align: 'left' | 'right';
}) {
  return (
    <span
      className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <Flag team={name} logo={logo} style={{ width: 24, height: 24 }} />
      <span className="truncate font-semibold text-main">{name}</span>
    </span>
  );
}

/** Cómo ha pronosticado la liga un partido: reparto 1X2, marcadores más repetidos y aciertos. */
export default function MatchStatsCard({ match, members }: { match: MatchStats; members: number }) {
  const shares = signShares(match);
  const real = realSign(match);
  const hasScore = match.homeScore != null && match.awayScore != null;
  const status = match.finished ? 'Final' : match.live ? 'En juego' : 'Empezado';
  const when = kickoff(match.matchDate);

  return (
    <article
      aria-label={`${match.homeTeam} contra ${match.awayTeam}`}
      className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5"
    >
      <div className="flex items-center gap-2">
        <Team name={match.homeTeam} logo={match.homeTeamLogo} align="left" />
        <span className="shrink-0 rounded-[8px] bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[1.05rem] font-extrabold tabular-nums text-main">
          {hasScore ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
        </span>
        <Team name={match.awayTeam} logo={match.awayTeamLogo} align="right" />
      </div>
      <p className="mt-1.5 mb-3 text-center text-[0.78rem] text-muted">
        <span className={match.live ? 'font-bold text-[#f87171]' : 'font-semibold'}>{status}</span>
        {when ? ` · ${when}` : ''} · {match.predictions} de {members}{' '}
        {members === 1 ? 'miembro' : 'miembros'} han pronosticado
      </p>

      <div
        className="flex h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]"
        aria-hidden="true"
      >
        {shares.map((s) =>
          s.percent > 0 ? (
            <span
              key={s.sign}
              className={`${SIGN_STYLE[s.sign].bar} h-full`}
              style={{ width: `${s.percent}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="m-0 mt-2 grid list-none grid-cols-3 gap-1.5 p-0 text-center">
        {shares.map((s) => {
          const isReal = real === s.sign;
          return (
            <li
              key={s.sign}
              className={`rounded-[8px] px-1 py-1.5 ${isReal ? 'bg-[rgba(74,222,128,0.1)] ring-1 ring-[rgba(74,222,128,0.4)]' : ''}`}
            >
              <span className="block text-[0.95rem] font-extrabold tabular-nums text-main">
                {s.sign} · {s.percent} %
              </span>
              <span className={`block text-[0.72rem] ${isReal ? 'text-[#4ade80]' : 'text-muted'}`}>
                {SIGN_STYLE[s.sign].label}
                {isReal ? ' ✓' : ''}
              </span>
              <span className="sr-only">
                {s.count} pronósticos{isReal ? ', es el resultado' : ''}
              </span>
            </li>
          );
        })}
      </ul>

      {match.topScores.length > 0 && (
        <div className="mt-3">
          <p className="m-0 mb-1.5 text-[0.8rem] font-semibold text-muted">
            Marcadores más repetidos
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {match.topScores.map((s) => {
              const exact =
                match.finished && s.home === match.homeScore && s.away === match.awayScore;
              return (
                <li
                  key={`${s.home}-${s.away}`}
                  className={`rounded-full border px-3 py-1 text-[0.88rem] tabular-nums ${exact ? 'border-[rgba(74,222,128,0.5)] bg-[rgba(74,222,128,0.1)] text-[#4ade80]' : 'border-line text-main'}`}
                >
                  <strong>
                    {s.home}-{s.away}
                  </strong>{' '}
                  <span className={exact ? '' : 'text-muted'}>× {s.count}</span>
                  {exact && <span className="sr-only"> (resultado exacto)</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {match.exactHits != null && match.signHits != null && (
        <p className="mt-3 mb-0 border-t border-line pt-2.5 text-[0.85rem] text-muted">
          Acertaron el resultado <strong className="text-main">{match.exactHits}</strong> y el signo{' '}
          <strong className="text-main">{match.signHits}</strong> de {match.predictions}.
        </p>
      )}
    </article>
  );
}
