import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { fetchCustomTeams, fetchCustomMatches } from '../services/api';
import type { CustomTeam } from '../services/api';
import type { Match } from '../types/api';
import { errorMessage } from '../utils/errors';
import { getCustomRoundTitle, getTotalRounds } from '../utils/customBracket';
import PaperLoading from '../components/PaperLoading';

export default function CustomTournamentHome() {
  const { activeGroupId, activeGroupName } = useAppContext();
  const [teams, setTeams] = useState<CustomTeam[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeGroupId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchCustomTeams(Number(activeGroupId)),
      fetchCustomMatches(Number(activeGroupId)),
    ])
      .then(([teamList, matchList]) => {
        if (!cancelled) {
          setTeams(teamList);
          setMatches(matchList);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason, 'No se pudo cargar la competición'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroupId]);

  const groups = teams.reduce<Record<string, string[]>>((result, team) => {
    if (team.groupName) (result[team.groupName] ??= []).push(team.name);
    return result;
  }, {});

  const firstRoundCount = matches.filter((m) => m.round === 'bracket-1').length;
  const totalRounds = getTotalRounds(firstRoundCount);

  return (
    <section className="view-section max-w-205 mx-auto">
      <h1 className="poster-title">{activeGroupName}</h1>
      {error && (
        <p role="alert" className="text-[var(--miss)]">
          {error}
        </p>
      )}
      <Link className="glass-btn primary-btn inline-block mb-5" to="/prediction">
        Rellenar mi pronóstico
      </Link>
      {loading && <PaperLoading label="Cargando competición…" />}
      {!loading &&
        Object.entries(groups).map(([name, members]) => (
          <div key={name} className="paper-panel album-sheet p-4 mb-4">
            <h2 className="poster-title">Grupo {name}</h2>
            <p>{members.join(' · ')}</p>
          </div>
        ))}
      {!loading && (
        <>
          <h2 className="poster-title">Partidos y cruces</h2>
          {matches.length === 0 && (
            <p className="paper-panel album-sheet p-5">Aún no hay partidos configurados.</p>
          )}
          {[...matches]
            .sort((left, right) => {
              const byRound = (left.round ?? '').localeCompare(right.round ?? '', 'es', {
                numeric: true,
              });
              return byRound || left.id - right.id;
            })
            .map((match) => {
              let roundLabel = 'Partido';
              if (match.round?.startsWith('bracket-')) {
                const roundNum = parseInt(match.round.substring(8), 10);
                roundLabel = !isNaN(roundNum)
                  ? getCustomRoundTitle(roundNum - 1, totalRounds)
                  : `Cuadro · ronda ${match.round.substring(8)}`;
              } else if (match.groupName) {
                roundLabel = `Grupo ${match.groupName}`;
              }

              return (
                <div key={match.id} className="paper-panel album-sheet p-4 mb-3">
                  <span className="text-muted text-xs uppercase tracking-wide font-bold">
                    {roundLabel}
                  </span>
                  <p className="font-bold mb-0 text-base mt-1">
                    {match.home} · {match.away_team_id ? match.away : 'Descanso'}
                  </p>
                  {match.finished && (
                    <p className="mb-0 text-sm mt-1">
                      {match.homeScore} - {match.awayScore}
                      {match.winner ? ` · Gana ${match.winner}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
        </>
      )}
    </section>
  );
}
