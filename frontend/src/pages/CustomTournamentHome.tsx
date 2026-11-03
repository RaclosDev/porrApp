import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { fetchCustomTeams, fetchCustomMatches } from '../services/api';
import type { CustomTeam } from '../services/api';
import type { Match } from '../types/api';
import { errorMessage } from '../utils/errors';

export default function CustomTournamentHome() {
  const { activeGroupId, activeCompetitionId, activeGroupName } = useAppContext();
  const [teams, setTeams] = useState<CustomTeam[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeGroupId || !activeCompetitionId) return;
    let cancelled = false;
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
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroupId, activeCompetitionId]);

  const groups = teams.reduce<Record<string, string[]>>((result, team) => {
    if (team.groupName) (result[team.groupName] ??= []).push(team.name);
    return result;
  }, {});
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
      {Object.entries(groups).map(([name, members]) => (
        <div key={name} className="paper-panel album-sheet p-4 mb-4">
          <h2 className="poster-title">Grupo {name}</h2>
          <p>{members.join(' · ')}</p>
        </div>
      ))}
      <h2 className="poster-title">Partidos y cruces</h2>
      {matches.length === 0 && <p>Aún no hay partidos configurados.</p>}
      {[...matches]
        .sort((left, right) => {
          const byRound = (left.round ?? '').localeCompare(right.round ?? '', 'es', {
            numeric: true,
          });
          return byRound || left.id - right.id;
        })
        .map((match) => (
          <div key={match.id} className="paper-panel album-sheet p-4 mb-3">
            <span className="text-muted">
              {match.round?.startsWith('bracket-')
                ? `Cuadro · ronda ${match.round.substring(8)}`
                : match.groupName
                  ? `Grupo ${match.groupName}`
                  : 'Partido'}
            </span>
            <p className="font-bold mb-0">
              {match.home} · {match.away_team_id ? match.away : 'Descanso'}
            </p>
            {match.finished && (
              <p className="mb-0">
                {match.homeScore} - {match.awayScore}
                {match.winner ? ` · Gana ${match.winner}` : ''}
              </p>
            )}
          </div>
        ))}
    </section>
  );
}
