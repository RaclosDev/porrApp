import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import { fetchCustomTeams, fetchCustomMatches } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import type { Match } from '../types/api';
import { errorMessage } from '../utils/errors';
import { formatMatchDate } from '../utils/matchday';
import {
  computeCustomGroupTables,
  computeCustomResultRounds,
  customMatchWinner,
  type CustomResultSlot,
} from '../utils/customBracket';
import PaperLoading from '../components/PaperLoading';
import Flag from '../components/Flag';

/** Portada de una competición personalizada: grupos, cuadro real y partidos con resultado. */
export default function CustomTournamentHome() {
  const {
    activeGroupId,
    activeGroupName,
    activeCompetitionName,
    activeGroupIsLocked,
    activeGroupLockDate,
  } = useAppContext();
  const saved = useMyLeaguePrediction();
  const groupId = activeGroupId ? Number(activeGroupId) : null;

  const teamsQuery = useQuery({
    queryKey: queryKeys.customTeams(activeGroupId),
    queryFn: () => fetchCustomTeams(groupId!),
    enabled: groupId != null,
  });
  const matchesQuery = useQuery({
    queryKey: queryKeys.customMatches(activeGroupId),
    queryFn: () => fetchCustomMatches(groupId!),
    enabled: groupId != null,
  });

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const logos = useMemo(
    () =>
      Object.fromEntries(
        teams.filter((team) => team.logoUrl).map((team) => [team.name, team.logoUrl as string]),
      ),
    [teams],
  );
  const groupTables = useMemo(() => computeCustomGroupTables(teams, matches), [teams, matches]);
  const rounds = useMemo(() => computeCustomResultRounds(matches), [matches]);
  const groupMatches = useMemo(
    () =>
      matches
        .filter((match) => match.round === 'group')
        .sort(
          (left, right) => (left.date ?? '').localeCompare(right.date ?? '') || left.id - right.id,
        ),
    [matches],
  );

  const loading = teamsQuery.isPending || matchesQuery.isPending;
  const loadError = teamsQuery.error ?? matchesQuery.error;
  const finalMatch = rounds[rounds.length - 1]?.slots[0]?.match;
  const champion = finalMatch ? customMatchWinner(finalMatch) : null;
  const hasGroups = Object.keys(groupTables).length > 0;

  let lockCopy = 'El administrador aún no ha fijado el cierre de pronósticos.';
  if (activeGroupIsLocked) lockCopy = 'Pronósticos cerrados.';
  else if (activeGroupLockDate) {
    lockCopy = `Pronósticos abiertos hasta el ${formatMatchDate(activeGroupLockDate)}.`;
  }

  return (
    <section className="view-section active max-w-270 mx-auto pb-6">
      <header className="paper-panel album-sheet p-5 mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="text-muted text-xs uppercase tracking-wide font-bold">
            {activeGroupName}
          </span>
          <h1 className="poster-title m-0 break-words">
            {activeCompetitionName || activeGroupName}
          </h1>
          <p className="m-0 mt-1 text-sm">{lockCopy}</p>
        </div>
        <Link className="glass-btn primary-btn inline-flex items-center min-h-11" to="/prediction">
          {saved || activeGroupIsLocked ? 'Ver mi pronóstico' : 'Rellenar mi pronóstico'}
        </Link>
      </header>

      {loadError && (
        <p role="alert" className="paper-panel album-sheet p-4 text-[var(--miss)]">
          {errorMessage(loadError, 'No se pudo cargar la competición')}
        </p>
      )}
      {loading && <PaperLoading label="Cargando competición…" />}

      {!loading && !loadError && (
        <>
          {champion && (
            <p className="paper-panel album-sheet p-4 mb-5 text-center border-2 border-[var(--gold)]">
              <span className="text-xs uppercase tracking-wider text-muted font-bold block mb-1">
                Campeón
              </span>
              <span className="poster-title text-xl text-[var(--gold)]">🏆 {champion}</span>
            </p>
          )}

          {hasGroups && (
            <section aria-labelledby="custom-groups-title" className="mb-6">
              <h2 id="custom-groups-title" className="poster-title">
                Fase de grupos
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(groupTables).map(([group, rows]) => (
                  <div key={group} className="paper-panel album-sheet p-4 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <caption className="poster-title text-left mb-2">Grupo {group}</caption>
                      <thead>
                        <tr className="text-muted text-xs uppercase border-b border-line">
                          <th scope="col" className="text-left py-1 pr-2 w-6">
                            #
                          </th>
                          <th scope="col" className="text-left py-1">
                            Equipo
                          </th>
                          <th scope="col" className="py-1 px-1 w-8" title="Partidos jugados">
                            PJ
                          </th>
                          <th scope="col" className="py-1 px-1 w-10" title="Diferencia de goles">
                            DG
                          </th>
                          <th scope="col" className="py-1 pl-1 w-10" title="Puntos">
                            Pts
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={row.team} className="border-b border-line last:border-0">
                            <td className="py-2 pr-2 text-muted">{index + 1}</td>
                            <td className="py-2 font-medium break-words">
                              <TeamName name={row.team} logo={logos[row.team]} />
                            </td>
                            <td className="py-2 px-1 text-center">{row.played}</td>
                            <td className="py-2 px-1 text-center">
                              {row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}
                              {row.goalsFor - row.goalsAgainst}
                            </td>
                            <td className="py-2 pl-1 text-center font-bold">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="custom-bracket-title" className="mb-6">
            <h2 id="custom-bracket-title" className="poster-title">
              Cuadro
            </h2>
            {rounds.length === 0 ? (
              <p className="paper-panel album-sheet p-5">
                El administrador aún no ha configurado los cruces.
              </p>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2">
                {rounds.map((round) => (
                  <div key={round.roundIndex} className="flex flex-col md:min-w-60 md:flex-1">
                    <h3 className="text-xs uppercase tracking-wide font-bold text-muted mb-2">
                      {round.title}
                    </h3>
                    <ol className="list-none m-0 p-0 flex flex-1 flex-col gap-3 md:justify-around">
                      {round.slots.map((slot, index) => (
                        <li key={slot.match?.id ?? `pending-${index}`}>
                          <ResultCard slot={slot} logos={logos} />
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>

          {groupMatches.length > 0 && (
            <section aria-labelledby="custom-group-matches-title">
              <h2 id="custom-group-matches-title" className="poster-title">
                Partidos de grupos
              </h2>
              <ul className="list-none m-0 p-0 grid gap-3 sm:grid-cols-2">
                {groupMatches.map((match) => (
                  <li key={match.id} className="paper-panel album-sheet p-4">
                    <span className="text-muted text-xs uppercase tracking-wide font-bold">
                      Grupo {match.groupName} · {formatMatchDate(match.date)}
                    </span>
                    <MatchLine match={match} logos={logos} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}

/** Nombre de equipo con su escudo, si lo tiene. */
function TeamName({ name, logo }: { name: string; logo?: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0 align-middle">
      {logo && <Flag team={name} logo={logo} />}
      <span className="break-words">{name}</span>
    </span>
  );
}

function MatchLine({ match, logos }: { match: Match; logos: Record<string, string> }) {
  const played = match.finished && match.homeScore != null && match.awayScore != null;
  return (
    <p className="m-0 mt-1 flex items-center justify-between gap-3 font-bold">
      <span className="min-w-0 break-words">
        <TeamName name={match.home} logo={match.homeLogo ?? logos[match.home]} /> ·{' '}
        <TeamName name={match.away} logo={match.awayLogo ?? logos[match.away]} />
      </span>
      <span className={played ? 'whitespace-nowrap' : 'whitespace-nowrap text-muted font-normal'}>
        {played ? `${match.homeScore} - ${match.awayScore}` : 'Por jugar'}
      </span>
    </p>
  );
}

function ResultCard({ slot, logos }: { slot: CustomResultSlot; logos: Record<string, string> }) {
  const match = slot.match;
  const winner = match ? customMatchWinner(match) : null;
  const played = Boolean(match?.finished && match.homeScore != null && match.awayScore != null);
  const sides = [
    { name: slot.home, placeholder: slot.homePlaceholder, score: match?.homeScore },
    {
      name: slot.away,
      placeholder: slot.awayPlaceholder,
      score: match?.awayScore,
      bye: slot.isBye,
    },
  ];

  return (
    <div className="paper-panel album-sheet p-3">
      {sides.map((side, index) => {
        const isWinner = Boolean(side.name && winner === side.name);
        return (
          <div
            key={index}
            className={`flex items-center justify-between gap-3 min-h-9 ${
              index === 0 ? 'border-b border-line' : ''
            }`}
          >
            <span
              className={`min-w-0 break-words ${
                side.name && !side.bye
                  ? isWinner
                    ? 'font-bold'
                    : winner
                      ? 'text-muted line-through'
                      : 'font-medium'
                  : 'text-muted italic'
              }`}
            >
              {side.name && !side.bye ? (
                <TeamName name={side.name} logo={logos[side.name]} />
              ) : (
                side.placeholder
              )}
              {isWinner && <span className="sr-only"> (ganador)</span>}
            </span>
            {played && <span className="font-bold tabular-nums">{side.score}</span>}
          </div>
        );
      })}
      {match && !played && !slot.isBye && match.date && (
        <p className="m-0 mt-1 text-xs text-muted">{formatMatchDate(match.date)}</p>
      )}
      {slot.isBye && <p className="m-0 mt-1 text-xs text-muted">Pasa por descanso</p>}
    </div>
  );
}
