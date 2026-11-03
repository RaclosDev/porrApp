import { useCallback, useEffect, useState } from 'react';
import {
  addCustomMatch,
  addCustomTeam,
  fetchCustomTeams,
  fetchMatches,
  setCustomResult,
} from '../../services/api';
import type { CustomTeam } from '../../services/api';
import type { Group, Match } from '../../types/api';
import { errorMessage } from '../../utils/errors';

export default function CustomCompetitionEditor({
  group,
  onClose,
}: {
  group: Group;
  onClose: () => void;
}) {
  const [teams, setTeams] = useState<CustomTeam[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamName, setTeamName] = useState('');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [scores, setScores] = useState<Record<number, { home: string; away: string }>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [teamList, matchList] = await Promise.all([
      fetchCustomTeams(group.id),
      fetchMatches(group.competitionId),
    ]);
    setTeams(teamList);
    setMatches(matchList);
  }, [group.id, group.competitionId]);

  useEffect(() => {
    void refresh().catch((reason: unknown) =>
      setError(errorMessage(reason, 'No se pudo cargar la competición')),
    );
  }, [refresh]);

  const save = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudieron guardar los cambios'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="paper-panel album-sheet p-5 my-5 max-w-205 mx-auto"
      role="region"
      aria-label={`Administrar ${group.competitionName}`}
    >
      <div className="flex justify-between items-center gap-3">
        <h3 className="poster-title m-0">{group.competitionName}</h3>
        <button type="button" className="glass-btn" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <p className="text-muted">
        Añade equipos y partidos. Los resultados los introduces tú cuando terminen.
      </p>
      {error && (
        <p role="alert" className="text-[var(--miss)]">
          {error}
        </p>
      )}
      <form
        className="flex gap-2 flex-wrap mb-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save(async () => {
            await addCustomTeam(group.id, teamName.trim());
            setTeamName('');
          });
        }}
      >
        <label className="flex-1 min-w-50">
          Equipo
          <input
            className="glass-input w-full"
            required
            maxLength={100}
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Nombre del equipo"
          />
        </label>
        <button type="submit" className="glass-btn primary-btn self-end" disabled={busy}>
          Añadir equipo
        </button>
      </form>
      <p className="text-muted">
        {teams.length} equipos: {teams.map((team) => team.name).join(', ') || 'ninguno todavía'}
      </p>
      <form
        className="flex gap-2 flex-wrap mb-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save(async () => {
            await addCustomMatch(group.id, Number(homeTeamId), Number(awayTeamId), matchDate);
            setMatchDate('');
          });
        }}
      >
        <label>
          Local
          <select
            className="glass-input w-full"
            required
            value={homeTeamId}
            onChange={(event) => setHomeTeamId(event.target.value)}
          >
            <option value="">Elige equipo</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Visitante
          <select
            className="glass-input w-full"
            required
            value={awayTeamId}
            onChange={(event) => setAwayTeamId(event.target.value)}
          >
            <option value="">Elige equipo</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha y hora
          <input
            className="glass-input w-full"
            type="datetime-local"
            required
            value={matchDate}
            onChange={(event) => setMatchDate(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="glass-btn primary-btn self-end"
          disabled={busy || teams.length < 2}
        >
          Añadir partido
        </button>
      </form>
      <h4>Partidos</h4>
      {matches.length === 0 && <p className="text-muted">Aún no hay partidos.</p>}
      <div className="flex flex-col gap-3">
        {matches.map((match) => (
          <div
            key={match.id}
            className="border border-line rounded-[8px] p-3 flex flex-wrap gap-3 items-end"
          >
            <div className="flex-1 min-w-45">
              <strong>
                {match.home} – {match.away}
              </strong>
              <br />
              <span className="text-muted text-sm">
                {match.date?.replace('T', ' ').slice(0, 16)}
              </span>
            </div>
            <label>
              Local
              <input
                className="glass-input w-18"
                type="number"
                min="0"
                value={scores[match.id]?.home ?? match.homeScore ?? ''}
                onChange={(event) =>
                  setScores((current) => ({
                    ...current,
                    [match.id]: {
                      home: event.target.value,
                      away: current[match.id]?.away ?? String(match.awayScore ?? ''),
                    },
                  }))
                }
              />
            </label>
            <label>
              Visitante
              <input
                className="glass-input w-18"
                type="number"
                min="0"
                value={scores[match.id]?.away ?? match.awayScore ?? ''}
                onChange={(event) =>
                  setScores((current) => ({
                    ...current,
                    [match.id]: {
                      home: current[match.id]?.home ?? String(match.homeScore ?? ''),
                      away: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <button
              type="button"
              className="glass-btn"
              disabled={
                busy ||
                (scores[match.id]?.home ?? match.homeScore ?? '') === '' ||
                (scores[match.id]?.away ?? match.awayScore ?? '') === ''
              }
              onClick={() =>
                void save(() =>
                  setCustomResult(
                    group.id,
                    match.id,
                    Number(scores[match.id]?.home ?? match.homeScore),
                    Number(scores[match.id]?.away ?? match.awayScore),
                  ),
                )
              }
            >
              {match.finished ? 'Actualizar' : 'Guardar resultado'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
