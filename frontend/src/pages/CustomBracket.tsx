import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import { createPrediction, fetchCustomTeams, fetchCustomMatches } from '../services/api';
import type { PredictionData } from '../types/api';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import {
  pairWinners,
  computeCustomBracketRounds,
  customMatchWinner,
  customRoundMatchIndex,
  splitCustomRounds,
  type CustomBracketMatchSlot,
  type CustomPair,
} from '../utils/customBracket';
import { useCustomLock } from '../hooks/useCustomLock';
import { officialBracketMatches } from '../utils/officialTournament';
import PaperLoading from '../components/PaperLoading';
import Flag from '../components/Flag';
import CustomSelect from '../components/CustomSelect';
import InkStamp from '../components/InkStamp';
import BracketCanvas, { TeamSlot, type CanvasMatch } from '../components/BracketCanvas';
import { BracketFinalMatch } from '../components/BracketFinale';
import BracketTeamStatus from '../components/BracketTeamStatus';

type Pair = CustomPair;

/** Texto para el lector de pantalla del equipo elegido en cada cruce. */
const PICK_LABELS = {
  picked: ' · tu predicción',
  hit: ' · tu predicción, acertada',
  miss: ' · tu predicción, fallada',
} as const;

const toCanvasMatch = (slot: CustomBracketMatchSlot): CanvasMatch<string | null> => ({
  home: slot.home,
  away: slot.isBye ? null : slot.away,
});

/**
 * Pronóstico de un cuadro propio, con el mismo cuadro que el pronóstico del Mundial: el de una
 * competición personalizada o los cruces reales de un torneo oficial (Worlds de LoL…).
 */
export default function CustomBracket() {
  const {
    activeGroupId,
    activeGroupPoolFormat,
    activeGroupName,
    activeGroupIsLocked,
    activeGroupCustomCompetition,
    allGames,
    userName,
  } = useAppContext();
  const official = !activeGroupCustomCompetition;
  const saved = useMyLeaguePrediction();
  const customLock = useCustomLock(activeGroupId);
  // Un torneo oficial siempre tiene cierre (su fecha o sus partidos), aunque aún no se conozca la fecha.
  const lock = official ? { ...customLock, configured: true } : customLock;
  const queryClient = useQueryClient();
  const groupId = activeGroupId ? Number(activeGroupId) : null;
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [picks, setPicks] = useState<string[][]>([]);
  // Solo hay un pronóstico por persona: se guarda con el nombre que ya tuviera o el del participante.
  const [predictionName, setPredictionName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState('');
  const failedRevision = useRef(-1);
  const [loadedKey, setLoadedKey] = useState('');

  const teamsQuery = useQuery({
    queryKey: queryKeys.customTeams(activeGroupId),
    queryFn: () => fetchCustomTeams(groupId!),
    enabled: groupId != null && !official,
  });
  const matchesQuery = useQuery({
    queryKey: queryKeys.customMatches(activeGroupId),
    queryFn: () => fetchCustomMatches(groupId!),
    enabled: groupId != null && !official,
  });
  const teams = useMemo(
    () =>
      official
        ? [...new Set(allGames.flatMap((match) => [match.home, match.away]))]
            .filter(Boolean)
            .map((name) => ({
              name,
              groupName: null,
              logoUrl:
                allGames.find((match) => match.home === name)?.homeLogo ||
                allGames.find((match) => match.away === name)?.awayLogo ||
                null,
            }))
        : (teamsQuery.data ?? []),
    [official, allGames, teamsQuery.data],
  );
  const matches = useMemo(
    () => (official ? officialBracketMatches(allGames) : (matchesQuery.data ?? [])),
    [official, allGames, matchesQuery.data],
  );
  const loadingData = !official && (teamsQuery.isPending || matchesQuery.isPending);
  const loadError = official ? null : (teamsQuery.error ?? matchesQuery.error);

  useEffect(() => {
    setGroups({});
    setPicks([]);
    setPredictionName('');
    setLoadedKey('');
    setError('');
    setRevision(0);
    setSaveState('idle');
    setLastSaved('');
    failedRevision.current = -1;
  }, [activeGroupId]);

  useEffect(() => {
    if (!saved || saved.key === loadedKey) return;
    setLoadedKey(saved.key);
    if (revision > 0) return;
    setGroups(saved.data?.groups ?? {});
    setPicks((saved.data?.customRounds ?? []).map((round) => round.map((pick) => pick ?? '')));
    setPredictionName(saved.predictionName ?? '');
  }, [saved, loadedKey, revision]);

  const logos = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.name, team.logoUrl] as const)),
    [teams],
  );

  const teamsByGroup = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const team of teams) {
      if (team.groupName) (result[team.groupName] ??= []).push(team.name);
    }
    return Object.fromEntries(
      Object.entries(result).sort(([left], [right]) => left.localeCompare(right, 'es')),
    );
  }, [teams]);

  const firstRound = useMemo<Pair[]>(
    () =>
      matches
        .filter((match) => match.round === 'bracket-1')
        // Los cruces oficiales ya llegan en el orden en que se pintan.
        .sort((left, right) => (official ? 0 : left.id - right.id))
        .map((match) => [match.home, match.away_team_id ? match.away : null]),
    [matches, official],
  );

  // Ganadores reales de cada ronda, para marcar aciertos y fallos en el pronóstico.
  const realWinners = useMemo(() => {
    const result: Set<string>[] = [];
    for (const match of matches) {
      const found = /^bracket-(\d+)$/.exec(match.round ?? '');
      const winner = found && match.away_team_id ? customMatchWinner(match) : null;
      if (found && winner) (result[Number(found[1]) - 1] ??= new Set()).add(winner);
    }
    return result;
  }, [matches]);
  // Ronda en la que cayó cada equipo, para marcarlo eliminado desde ahí en adelante.
  const eliminatedAt = useMemo(() => {
    const result = new Map<string, number>();
    for (const match of matches) {
      const found = /^bracket-(\d+)$/.exec(match.round ?? '');
      const winner = found && match.away_team_id ? customMatchWinner(match) : null;
      if (!found || !winner) continue;
      const loser = winner === match.home ? match.away : match.home;
      if (loser) result.set(loser, Number(found[1]) - 1);
    }
    return result;
  }, [matches]);
  const decidedRounds = useMemo(() => {
    const result: boolean[] = [];
    for (const match of matches) {
      const found = /^bracket-(\d+)$/.exec(match.round ?? '');
      if (!found) continue;
      const index = Number(found[1]) - 1;
      result[index] = (result[index] ?? true) && (!match.away_team_id || match.finished);
    }
    return result;
  }, [matches]);

  const displayRounds = useMemo(
    () => computeCustomBracketRounds(firstRound, picks),
    [firstRound, picks],
  );
  const layout = useMemo(
    () => splitCustomRounds(displayRounds.map((round) => round.matches)),
    [displayRounds],
  );

  // Se abre en la primera ronda con partidos reales por jugar, como en los resultados.
  const currentRound = useMemo(() => {
    const semiIndex = layout.roundLabels.length - 1;
    const pending = displayRounds.findIndex((_, index) => !decidedRounds[index]);
    return pending < 0 ? semiIndex : Math.min(pending, semiIndex);
  }, [displayRounds, decidedRounds, layout.roundLabels.length]);

  const isFullBracket = activeGroupPoolFormat === 'FULL_BRACKET';
  const hasGroups = isFullBracket && Object.keys(teamsByGroup).length > 0;
  // Quien no tiene pronóstico no puede entrar cuando la competición ya ha empezado a cerrarse.
  const lateEntry = lock.anyLocked && !saved;
  const editable = !activeGroupIsLocked && !lock.fullyLocked && !lateEntry;
  const finalRoundIndex = displayRounds.length - 1;
  const finalPick = picks[finalRoundIndex]?.[0];
  const champion =
    layout.final &&
    finalPick &&
    (finalPick === layout.final.home || finalPick === layout.final.away)
      ? finalPick
      : null;

  const selectWinner = (round: number, match: number, name: string) => {
    if (picks[round]?.[match] === name) return;
    setRevision((current) => current + 1);
    setSaveState('idle');
    setError('');
    setPicks((previous) => {
      const next = previous.slice(0, round + 1).map((items) => [...items]);
      next[round] ??= [];
      next[round][match] = name;
      return next;
    });
  };

  /** Coloca un equipo en un puesto del grupo y lo quita del puesto que ocupaba. */
  const selectGroupPosition = (group: string, position: number, name: string) => {
    setRevision((current) => current + 1);
    setSaveState('idle');
    setError('');
    setGroups((current) => {
      const size = teamsByGroup[group]?.length ?? 0;
      const order = Array.from({ length: size }, (_, index) => current[group]?.[index] ?? '');
      const previous = order.indexOf(name);
      if (name && previous !== -1) order[previous] = '';
      order[position] = name;
      return { ...current, [group]: order };
    });
  };

  /** Casilla de un equipo; al pulsarla pasa a la siguiente ronda. */
  const renderPickSlot = (
    slot: CustomBracketMatchSlot | null | undefined,
    roundIndex: number,
    matchIndex: number,
    isHome: boolean,
  ) => {
    if (!slot) return <TeamSlot name={null} />;
    const name = isHome ? slot.home : slot.isBye ? null : slot.away;
    const label = name ?? (isHome ? slot.homePlaceholder : slot.awayPlaceholder);
    const picked = Boolean(name && !slot.isBye && picks[roundIndex]?.[matchIndex] === name);
    const qualified = Boolean(name && realWinners[roundIndex]?.has(name));
    const outRound = name ? eliminatedAt.get(name) : undefined;
    const eliminated = !qualified && outRound != null && outRound <= roundIndex;
    const outcome = !picked
      ? null
      : qualified
        ? 'hit'
        : eliminated || decidedRounds[roundIndex]
          ? 'miss'
          : 'picked';
    const classes = [outcome ? `is-${outcome}` : '', eliminated && !picked ? 'is-out' : '']
      .filter(Boolean)
      .join(' ');
    return (
      <TeamSlot
        name={label}
        logo={name ? logos[name] : null}
        placeholder={!name}
        pressed={picked}
        className={classes}
        onClick={
          editable && name && !slot.isBye && !lock.pickLocked(roundIndex, matchIndex)
            ? () => selectWinner(roundIndex, matchIndex, name)
            : undefined
        }
        rightContent={
          <>
            {outcome && <span className="sr-only">{PICK_LABELS[outcome]}</span>}
            <BracketTeamStatus
              outcome={qualified ? 'qualified' : eliminated ? 'eliminated' : null}
            />
          </>
        }
      />
    );
  };

  const completeData = useMemo((): PredictionData | null => {
    if (!firstRound.length) return null;
    const orderedGroups: Record<string, string[]> = {};
    if (isFullBracket) {
      for (const [group, members] of Object.entries(teamsByGroup)) {
        const order = groups[group] ?? [];
        if (
          order.length !== members.length ||
          new Set(order).size !== members.length ||
          order.some((name) => !members.includes(name))
        ) {
          return null;
        }
        orderedGroups[group] = order;
      }
    }
    const completed: string[][] = [];
    let current = firstRound;
    while (current.length > 0) {
      const winners = pairWinners(current, picks[completed.length] ?? []);
      if (!winners) {
        return null;
      }
      completed.push(winners);
      if (winners.length === 1) break;
      const next: Pair[] = [];
      for (let slot = 0; slot < winners.length; slot += 2) {
        next.push([winners[slot], winners[slot + 1] ?? null]);
      }
      current = next;
    }
    const championPick = completed[completed.length - 1]?.[0];
    if (!championPick) {
      return null;
    }
    return {
      user: userName,
      prediction: predictionName.trim() || userName || 'Mi pronóstico',
      groups: orderedGroups,
      customRounds: completed,
      r16: [],
      champion: championPick,
    };
  }, [firstRound, groups, isFullBracket, picks, predictionName, teamsByGroup, userName]);

  useEffect(() => {
    if (!revision || !editable || !lock.configured || !activeGroupId || !completeData || busy)
      return;
    const fingerprint = JSON.stringify(completeData);
    if (fingerprint === lastSaved || failedRevision.current === revision) return;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void createPrediction(completeData, activeGroupId)
        .then(async () => {
          setLastSaved(fingerprint);
          setSaveState('saved');
          setError('');
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.myPredictions() }),
            queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(activeGroupId) }),
          ]);
        })
        .catch((reason: unknown) => {
          failedRevision.current = revision;
          setSaveState('error');
          setError(errorMessage(reason, 'No se pudo guardar el pronóstico'));
        })
        .finally(() => setBusy(false));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [
    activeGroupId,
    busy,
    completeData,
    editable,
    lastSaved,
    lock.configured,
    queryClient,
    revision,
  ]);

  return (
    <section className="view-section active block" aria-label={`Pronóstico de ${activeGroupName}`}>
      {editable && lock.configured && firstRound.length > 0 && (
        <p className="text-center text-muted text-[0.85rem] mb-[15px] min-h-[1.3em]" role="status">
          {error ? (
            <>
              <span role="alert" className="text-[var(--miss)]">
                {error}
              </span>{' '}
              <button
                type="button"
                className="glass-btn"
                onClick={() => setRevision((value) => value + 1)}
              >
                Reintentar
              </button>
            </>
          ) : busy ? (
            'Guardando…'
          ) : revision === 0 ? null : saveState === 'saved' &&
            completeData &&
            JSON.stringify(completeData) === lastSaved ? (
            '✓ Guardado'
          ) : completeData ? (
            'Guardando…'
          ) : null}
        </p>
      )}
      {lateEntry && !lock.fullyLocked && (
        <p className="paper-panel album-sheet p-4 max-w-145 mx-auto text-center" role="status">
          La competición ya ha empezado: no se admiten pronósticos nuevos.
        </p>
      )}
      {(activeGroupIsLocked || lock.fullyLocked) && (
        <p className="flex items-center justify-center gap-3 mb-[15px] text-[0.9rem] text-muted">
          <InkStamp>Pronóstico cerrado</InkStamp>
          El plazo para enviarlo o cambiarlo ha terminado.
        </p>
      )}
      {loadError && (
        <p role="alert" className="paper-panel album-sheet p-4 text-[var(--miss)]">
          {errorMessage(loadError, 'No se pudo cargar el cuadro')}
        </p>
      )}
      {loadingData && <PaperLoading label="Cargando cuadro del torneo…" />}

      {!loadingData && hasGroups && (
        <div className="w-full mb-7.5">
          <div className="text-center mb-7.5">
            <h2 className="poster-title text-accent-text m-0">Fase de grupos</h2>
          </div>
          <div className="groups-grid">
            {Object.entries(teamsByGroup).map(([group, members], groupIndex) => (
              <div
                key={group}
                className="group-card paper-panel album-sheet relative flex flex-col gap-2"
                style={{ zIndex: 50 - groupIndex }}
              >
                <h3 className="mt-0 mb-[5px] mx-0 text-center border-b border-b-line pb-1.5 text-[1.1rem]">
                  Grupo {group}
                </h3>
                <div className="grid grid-cols-[1fr_1fr] gap-1.5 mb-3">
                  {members.map((name) => (
                    <div
                      className="flex items-center justify-center gap-1.5 text-[0.85rem] bg-panel bg-none p-1.5 rounded-[4px] overflow-hidden"
                      key={name}
                    >
                      <Flag team={name} logo={logos[name]} style={{ width: 16, height: 16 }} />
                      <span
                        className="whitespace-nowrap overflow-hidden text-ellipsis font-medium"
                        title={name}
                      >
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
                {members.map((_, position) => (
                  <div className="flex flex-col gap-1" key={position}>
                    <span className="text-[0.8rem] text-accent-text font-bold">
                      {position + 1}.º clasificado
                    </span>
                    {editable && !lock.groupLocked(group) ? (
                      <CustomSelect
                        value={groups[group]?.[position] ?? ''}
                        onChange={(value) => selectGroupPosition(group, position, value)}
                        label={`Grupo ${group}, ${position + 1}.º clasificado`}
                        placeholder="Elige equipo"
                        options={[
                          { value: '', label: 'Elige equipo' },
                          ...members.map((name) => ({ value: name, label: name })),
                        ]}
                      />
                    ) : (
                      <span className="glass-input">{groups[group]?.[position] || '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loadingData && !loadError && (
        <>
          <div className="section-header mb-7.5 text-center">
            <h2 className="m-0 poster-title">Eliminatorias</h2>
            {editable && firstRound.length > 0 && !saved && revision === 0 && (
              <p className="text-muted mt-2 text-[0.9rem]">
                Pulsa un equipo para pasarlo a la siguiente ronda
              </p>
            )}
            {picks.some((round) => round.some(Boolean)) && (
              <ul className="pick-legend" aria-label="Leyenda del cuadro">
                <li>
                  <span className="pick-legend-swatch is-picked" aria-hidden="true" />
                  Tu predicción
                </li>
                {decidedRounds.some(Boolean) && (
                  <>
                    <li>
                      <span className="pick-legend-swatch is-hit" aria-hidden="true" />
                      Acertada
                    </li>
                    <li>
                      <span className="pick-legend-swatch is-miss" aria-hidden="true" />
                      Fallada
                    </li>
                  </>
                )}
              </ul>
            )}
          </div>

          {!firstRound.length && (
            <p className="paper-panel album-sheet p-5 text-center max-w-145 mx-auto">
              {official
                ? 'Aún no hay cruces del cuadro: podrás pronosticarlo cuando termine la fase previa.'
                : 'El administrador aún no ha configurado los cruces.'}
            </p>
          )}

          {layout.final && (
            <BracketCanvas
              leftRounds={layout.left.map((round) => round.map(toCanvasMatch))}
              rightRounds={layout.right.map((round) => round.map(toCanvasMatch))}
              roundLabels={layout.roundLabels}
              defaultRound={currentRound}
              centerLabel={layout.roundLabels.length ? 'Semifinales y final' : 'Final'}
              renderSlot={(_, { side, roundIndex, matchIndex, isHome }) =>
                renderPickSlot(
                  layout[side][roundIndex]?.[matchIndex],
                  roundIndex,
                  customRoundMatchIndex(layout, side, roundIndex, matchIndex),
                  isHome,
                )
              }
              renderFinal={() => (
                <BracketFinalMatch
                  editable={editable}
                  home={renderPickSlot(layout.final, finalRoundIndex, 0, true)}
                  away={renderPickSlot(layout.final, finalRoundIndex, 0, false)}
                  champion={
                    <TeamSlot
                      name={champion}
                      logo={champion ? logos[champion] : null}
                      placeholder={!champion}
                    />
                  }
                />
              )}
            />
          )}

          {lock.state && !lock.configured && (
            <p className="paper-panel album-sheet p-5 mt-7.5 text-center max-w-145 mx-auto">
              El administrador debe fijar el cierre antes de que se puedan guardar pronósticos.
            </p>
          )}
        </>
      )}
    </section>
  );
}
