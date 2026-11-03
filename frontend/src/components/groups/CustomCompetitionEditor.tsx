import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  addCustomMatch,
  addCustomTeam,
  deleteCustomMatch,
  deleteCustomTeam,
  fetchCustomTeams,
  fetchCustomMatches,
  setCustomResult,
  setCustomLockDate,
} from '../../services/api';
import type { CustomTeam } from '../../services/api';
import type { Group, Match } from '../../types/api';
import { errorMessage } from '../../utils/errors';
import { queryKeys } from '../../services/queryKeys';

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
  const [teamGroup, setTeamGroup] = useState('');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [lockDate, setLockDate] = useState(group.lockDate?.slice(0, 16) ?? '');
  const [matchRound, setMatchRound] = useState(
    group.poolFormat === 'KNOCKOUTS_ONLY' ? 'bracket-1' : 'group',
  );
  const [winnerIds, setWinnerIds] = useState<Record<number, string>>({});
  const [scores, setScores] = useState<Record<number, { home: string; away: string }>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    const [teamList, matchList] = await Promise.all([
      fetchCustomTeams(group.id),
      fetchCustomMatches(group.id),
    ]);
    setTeams(teamList);
    setMatches(matchList);
  }, [group.id]);

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
        {group.poolFormat !== 'MATCH_DAY' &&
          ' Elige qué equipos pasan al cuadro y crea sus cruces de la primera ronda en el orden en que deben aparecer. Usa «Descanso» si un equipo pasa directamente.'}
      </p>
      {group.poolFormat !== 'MATCH_DAY' && (
        <form
          className="flex gap-2 flex-wrap items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void save(async () => {
              await setCustomLockDate(group.id, lockDate);
              await queryClient.invalidateQueries({
                queryKey: queryKeys.group(group.id.toString()),
              });
              await queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
            });
          }}
        >
          <label>
            Cierre de pronósticos
            <input
              className="glass-input w-full"
              type="datetime-local"
              required
              value={lockDate}
              onChange={(event) => setLockDate(event.target.value)}
            />
          </label>
          <button type="submit" className="glass-btn primary-btn" disabled={busy}>
            Guardar cierre
          </button>
          <p className="text-muted w-full m-0">
            Fija el cierre antes de compartir la liga. Después del primer pronóstico no se puede
            cambiar.
          </p>
        </form>
      )}
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
            await addCustomTeam(group.id, teamName.trim(), teamGroup.trim() || undefined);
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
        {group.poolFormat === 'FULL_BRACKET' && (
          <label className="flex-1 min-w-40">
            Grupo
            <input
              className="glass-input w-full"
              required
              maxLength={50}
              value={teamGroup}
              onChange={(event) => setTeamGroup(event.target.value)}
              placeholder="Ej.: A"
            />
          </label>
        )}
        <button type="submit" className="glass-btn primary-btn self-end" disabled={busy}>
          Añadir equipo
        </button>
      </form>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-muted">{teams.length} equipos:</span>
        {teams.map((team) => (
          <span
            key={team.id}
            className="border border-line rounded-[8px] p-2 flex items-center gap-2"
          >
            {team.name}
            {team.groupName ? ` (${team.groupName})` : ''}
            <button
              type="button"
              className="glass-btn"
              disabled={busy}
              aria-label={`Eliminar equipo ${team.name}`}
              onClick={() => {
                if (window.confirm(`¿Eliminar el equipo ${team.name}?`)) {
                  void save(() => deleteCustomTeam(group.id, team.id));
                }
              }}
            >
              ✕
            </button>
          </span>
        ))}
        {!teams.length && <span className="text-muted">ninguno todavía</span>}
      </div>
      <form
        className="flex gap-2 flex-wrap mb-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save(async () => {
            await addCustomMatch(
              group.id,
              Number(homeTeamId),
              awayTeamId ? Number(awayTeamId) : null,
              matchDate || null,
              group.poolFormat === 'MATCH_DAY' ? undefined : matchRound,
            );
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
            required={group.poolFormat === 'MATCH_DAY' || matchRound === 'group'}
            value={awayTeamId}
            onChange={(event) => setAwayTeamId(event.target.value)}
          >
            <option value="">
              {matchRound.startsWith('bracket-') ? 'Descanso' : 'Elige equipo'}
            </option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        {group.poolFormat !== 'MATCH_DAY' && (
          <label>
            Fase
            <select
              className="glass-input w-full"
              value={matchRound === 'group' ? 'group' : 'bracket'}
              onChange={(event) =>
                setMatchRound(event.target.value === 'group' ? 'group' : 'bracket-1')
              }
            >
              {group.poolFormat === 'FULL_BRACKET' && <option value="group">Grupos</option>}
              <option value="bracket">Cuadro</option>
            </select>
          </label>
        )}
        {matchRound.startsWith('bracket-') && (
          <label>
            Número de ronda
            <input
              className="glass-input w-full"
              type="number"
              min="1"
              max="31"
              step="1"
              required
              value={matchRound.substring(8)}
              onChange={(event) => setMatchRound(`bracket-${event.target.value}`)}
            />
          </label>
        )}
        <label>
          Fecha y hora
          <input
            className="glass-input w-full"
            type="datetime-local"
            required={!matchRound.startsWith('bracket-')}
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
                !match.away_team_id ||
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
                    winnerIds[match.id] ? Number(winnerIds[match.id]) : undefined,
                  ),
                )
              }
            >
              {match.finished ? 'Actualizar' : 'Guardar resultado'}
            </button>
            <button
              type="button"
              className="glass-btn"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`¿Eliminar el partido ${match.home} – ${match.away}?`)) {
                  void save(() => deleteCustomMatch(group.id, match.id));
                }
              }}
            >
              Eliminar partido
            </button>
            {match.round?.startsWith('bracket-') &&
              (scores[match.id]?.home ?? match.homeScore ?? '') !== '' &&
              (scores[match.id]?.away ?? match.awayScore ?? '') !== '' &&
              Number(scores[match.id]?.home ?? match.homeScore) ===
                Number(scores[match.id]?.away ?? match.awayScore) && (
                <label>
                  Ganador del empate
                  <select
                    className="glass-input"
                    value={winnerIds[match.id] ?? ''}
                    onChange={(event) =>
                      setWinnerIds((current) => ({ ...current, [match.id]: event.target.value }))
                    }
                  >
                    <option value="">Elige equipo</option>
                    <option value={match.home_team_id ?? ''}>{match.home}</option>
                    <option value={match.away_team_id ?? ''}>{match.away}</option>
                  </select>
                </label>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
