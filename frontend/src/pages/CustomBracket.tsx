import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import { createPrediction, fetchCustomTeams, fetchCustomMatches } from '../services/api';
import type { CustomTeam } from '../services/api';
import type { Match, PredictionData } from '../types/api';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import { pairWinners, type CustomPair } from '../utils/customBracket';

type Pair = CustomPair;

export default function CustomBracket() {
  const {
    activeGroupId,
    activeCompetitionId,
    activeGroupPoolFormat,
    activeGroupName,
    activeGroupIsLocked,
    activeGroupLockDate,
    userName,
  } = useAppContext();
  const saved = useMyLeaguePrediction();
  const queryClient = useQueryClient();
  const [teams, setTeams] = useState<CustomTeam[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [picks, setPicks] = useState<string[][]>([]);
  const [predictionName, setPredictionName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');

  useEffect(() => {
    setTeams([]);
    setMatches([]);
    setGroups({});
    setPicks([]);
    setPredictionName('');
    setLoadedKey('');
    setError('');
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId || !activeCompetitionId) return;
    let cancelled = false;
    Promise.all([
      fetchCustomTeams(Number(activeGroupId)),
      fetchCustomMatches(Number(activeGroupId)),
    ])
      .then(([teamList, matchList]) => {
        if (cancelled) return;
        setTeams(teamList);
        setMatches(matchList);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason, 'No se pudo cargar el cuadro'));
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroupId, activeCompetitionId]);

  useEffect(() => {
    if (!saved || saved.key === loadedKey) return;
    setLoadedKey(saved.key);
    setGroups(saved.data?.groups ?? {});
    setPicks(saved.data?.customRounds ?? []);
    setPredictionName(saved.predictionName ?? '');
  }, [saved, loadedKey]);

  const teamsByGroup = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const team of teams) {
      if (team.groupName) (result[team.groupName] ??= []).push(team.name);
    }
    return result;
  }, [teams]);
  const firstRound = useMemo<Pair[]>(
    () =>
      matches
        .filter((match) => match.round === 'bracket-1')
        .sort((left, right) => left.id - right.id)
        .map((match) => [match.home, match.away_team_id ? match.away : null]),
    [matches],
  );

  const rounds: Pair[][] = [];
  if (firstRound.length > 0) {
    let current = firstRound;
    for (let index = 0; current.length > 0; index++) {
      rounds.push(current);
      const winners = pairWinners(current, picks[index] ?? []);
      if (!winners || winners.length === 1) break;
      const next: Pair[] = [];
      for (let slot = 0; slot < winners.length; slot += 2) {
        next.push([winners[slot], winners[slot + 1] ?? null]);
      }
      current = next;
    }
  }

  const selectWinner = (round: number, match: number, name: string) => {
    setPicks((previous) => {
      const next = previous.slice(0, round + 1).map((items) => [...items]);
      next[round] ??= [];
      next[round][match] = name;
      return next;
    });
  };

  const save = async () => {
    if (!activeGroupId || !firstRound.length) return;
    setError('');
    const orderedGroups: Record<string, string[]> = {};
    if (activeGroupPoolFormat === 'FULL_BRACKET') {
      for (const [group, members] of Object.entries(teamsByGroup)) {
        const order = groups[group] ?? [];
        if (
          order.length !== members.length ||
          new Set(order).size !== members.length ||
          order.some((name) => !members.includes(name))
        ) {
          setError(`Completa la clasificación del grupo ${group}`);
          return;
        }
        orderedGroups[group] = order;
      }
    }
    const completed: string[][] = [];
    let current = firstRound;
    while (current.length > 0) {
      const winners = pairWinners(current, picks[completed.length] ?? []);
      if (!winners) {
        setError('Elige un ganador en todos los cruces');
        return;
      }
      completed.push(winners);
      if (winners.length === 1) break;
      const next: Pair[] = [];
      for (let slot = 0; slot < winners.length; slot += 2) {
        next.push([winners[slot], winners[slot + 1] ?? null]);
      }
      current = next;
    }
    const champion = completed[completed.length - 1]?.[0];
    if (!champion || !predictionName.trim()) {
      setError('Indica un nombre para tu pronóstico');
      return;
    }
    setBusy(true);
    try {
      const data: PredictionData = {
        user: userName,
        prediction: predictionName.trim(),
        groups: orderedGroups,
        customRounds: completed,
        r16: [],
        champion,
      };
      await createPrediction(data, activeGroupId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.myPredictions() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(activeGroupId) });
      toast.success('Pronóstico guardado');
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo guardar el pronóstico'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view-section max-w-205 mx-auto" aria-label={`Cuadro de ${activeGroupName}`}>
      <h1 className="poster-title">Mi pronóstico · {activeGroupName}</h1>
      {error && (
        <p role="alert" className="text-[var(--miss)]">
          {error}
        </p>
      )}
      {activeGroupPoolFormat === 'FULL_BRACKET' && (
        <p className="text-muted">
          Ordena los equipos de cada grupo. Los cruces del cuadro los configura el administrador.
        </p>
      )}
      {activeGroupPoolFormat === 'FULL_BRACKET' &&
        Object.entries(teamsByGroup).map(([group, members]) => (
          <div key={group} className="paper-panel album-sheet p-4 mb-4">
            <h2 className="poster-title">Grupo {group}</h2>
            {members.map((_, index) => (
              <label key={index} className="block mb-2">
                {index + 1}.º puesto
                <select
                  className="glass-input w-full"
                  disabled={activeGroupIsLocked}
                  value={groups[group]?.[index] ?? ''}
                  onChange={(event) =>
                    setGroups((current) => {
                      const order = [...(current[group] ?? Array(members.length).fill(''))];
                      order[index] = event.target.value;
                      return { ...current, [group]: order };
                    })
                  }
                >
                  <option value="">Elige equipo</option>
                  {members.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ))}
      {!firstRound.length && (
        <p className="paper-panel album-sheet p-5">
          El administrador aún no ha configurado los cruces.
        </p>
      )}
      {!activeGroupLockDate && (
        <p className="paper-panel album-sheet p-5">
          El administrador debe fijar el cierre antes de que se puedan guardar pronósticos.
        </p>
      )}
      {rounds.map((round, index) => (
        <div key={index} className="paper-panel album-sheet p-4 mb-4">
          <h2 className="poster-title">
            Ronda {index + 1}
            {round.length === 1 ? ' · final' : ''}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {round.map(([home, away], matchIndex) => (
              <fieldset key={matchIndex} className="border border-line rounded-[8px] p-3">
                <legend>Cruce {matchIndex + 1}</legend>
                {[home, away]
                  .filter((name): name is string => Boolean(name))
                  .map((name) => (
                    <label key={name} className="flex items-center gap-2 min-h-11">
                      <input
                        type="radio"
                        name={`round-${index}-match-${matchIndex}`}
                        checked={(picks[index]?.[matchIndex] ?? (!away ? home : '')) === name}
                        disabled={activeGroupIsLocked || !away}
                        onChange={() => selectWinner(index, matchIndex, name)}
                      />
                      {name}
                    </label>
                  ))}
                {!away && <p className="text-muted m-0">Pasa por descanso</p>}
              </fieldset>
            ))}
          </div>
        </div>
      ))}
      {firstRound.length > 0 && activeGroupLockDate && !activeGroupIsLocked && (
        <div className="paper-panel album-sheet p-4 mb-6">
          <label className="block mb-3">
            Nombre del pronóstico
            <input
              className="glass-input w-full"
              maxLength={100}
              value={predictionName}
              onChange={(event) => setPredictionName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="glass-btn primary-btn"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Guardando…' : 'Guardar pronóstico'}
          </button>
        </div>
      )}
    </section>
  );
}
