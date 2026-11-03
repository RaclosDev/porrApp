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
import { pairWinners, computeCustomBracketRounds, type CustomPair } from '../utils/customBracket';
import PaperLoading from '../components/PaperLoading';

type Pair = CustomPair;

export default function CustomBracket() {
  const {
    activeGroupId,
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
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setTeams([]);
    setMatches([]);
    setGroups({});
    setPicks([]);
    setPredictionName('');
    setLoadedKey('');
    setError('');
    setLoadingData(true);
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId) return;
    let cancelled = false;
    setLoadingData(true);
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
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroupId]);

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

  const displayRounds = useMemo(
    () => computeCustomBracketRounds(firstRound, picks),
    [firstRound, picks],
  );

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
      {loadingData && <PaperLoading label="Cargando cuadro del torneo…" />}
      {!loadingData && !firstRound.length && (
        <p className="paper-panel album-sheet p-5">
          El administrador aún no ha configurado los cruces.
        </p>
      )}
      {!loadingData && !activeGroupLockDate && (
        <p className="paper-panel album-sheet p-5">
          El administrador debe fijar el cierre antes de que se puedan guardar pronósticos.
        </p>
      )}
      {!loadingData &&
        displayRounds.map((round) => (
          <div key={round.roundIndex} className="paper-panel album-sheet p-4 mb-4">
            <h2 className="poster-title">{round.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {round.matches.map((match, matchIndex) => {
                const currentPick = picks[round.roundIndex]?.[matchIndex] ?? '';
                return (
                  <fieldset key={matchIndex} className="border border-line rounded-[8px] p-3">
                    <legend className="text-xs uppercase tracking-wide text-muted font-bold px-1">
                      Cruce {matchIndex + 1}
                    </legend>
                    <div className="flex flex-col gap-2 mt-1">
                      {match.home ? (
                        <label className="flex items-center gap-2 min-h-11 cursor-pointer">
                          <input
                            type="radio"
                            name={`round-${round.roundIndex}-match-${matchIndex}`}
                            checked={currentPick === match.home}
                            disabled={activeGroupIsLocked || match.isBye}
                            onChange={() => selectWinner(round.roundIndex, matchIndex, match.home!)}
                          />
                          <span className="font-medium">{match.home}</span>
                        </label>
                      ) : (
                        <div className="flex items-center gap-2 min-h-11 text-muted italic">
                          <span className="w-3 h-3 rounded-full border border-dashed border-line inline-block" />
                          <span>{match.homePlaceholder}</span>
                        </div>
                      )}

                      {!match.isBye &&
                        (match.away ? (
                          <label className="flex items-center gap-2 min-h-11 cursor-pointer">
                            <input
                              type="radio"
                              name={`round-${round.roundIndex}-match-${matchIndex}`}
                              checked={currentPick === match.away}
                              disabled={activeGroupIsLocked}
                              onChange={() =>
                                selectWinner(round.roundIndex, matchIndex, match.away!)
                              }
                            />
                            <span className="font-medium">{match.away}</span>
                          </label>
                        ) : (
                          <div className="flex items-center gap-2 min-h-11 text-muted italic">
                            <span className="w-3 h-3 rounded-full border border-dashed border-line inline-block" />
                            <span>{match.awayPlaceholder}</span>
                          </div>
                        ))}
                      {match.isBye && <p className="text-muted m-0 text-xs">Pasa por descanso</p>}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        ))}
      {!loadingData &&
        displayRounds.length > 0 &&
        (() => {
          const finalRoundIndex = displayRounds.length - 1;
          const champ = picks[finalRoundIndex]?.[0];
          if (!champ) return null;
          return (
            <div className="paper-panel album-sheet p-4 mb-4 text-center border-2 border-[var(--gold)]">
              <span className="text-xs uppercase tracking-wider text-muted font-bold block mb-1">
                Tu campeón pronosticado
              </span>
              <p className="poster-title text-xl mb-0 text-[var(--gold)]">🏆 {champ}</p>
            </div>
          );
        })()}
      {!loadingData && firstRound.length > 0 && activeGroupLockDate && !activeGroupIsLocked && (
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
