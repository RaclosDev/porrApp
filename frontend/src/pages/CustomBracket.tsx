import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
import PaperLoading from '../components/PaperLoading';
import Flag from '../components/Flag';
import CustomSelect from '../components/CustomSelect';
import InkStamp from '../components/InkStamp';
import BracketCanvas, { TeamSlot, type CanvasMatch } from '../components/BracketCanvas';
import { BracketFinalMatch } from '../components/BracketFinale';

type Pair = CustomPair;

const toCanvasMatch = (slot: CustomBracketMatchSlot): CanvasMatch<string | null> => ({
  home: slot.home,
  away: slot.isBye ? null : slot.away,
});

/** Pronóstico de una competición personalizada, con el mismo cuadro que el pronóstico del Mundial. */
export default function CustomBracket() {
  const { activeGroupId, activeGroupPoolFormat, activeGroupName, activeGroupIsLocked, userName } =
    useAppContext();
  const saved = useMyLeaguePrediction();
  const lock = useCustomLock(activeGroupId);
  const queryClient = useQueryClient();
  const groupId = activeGroupId ? Number(activeGroupId) : null;
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [picks, setPicks] = useState<string[][]>([]);
  // Solo hay un pronóstico por persona: se guarda con el nombre que ya tuviera o el del participante.
  const [predictionName, setPredictionName] = useState('');
  const savedNoticeShown = useRef(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');

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
  const loadingData = teamsQuery.isPending || matchesQuery.isPending;
  const loadError = teamsQuery.error ?? matchesQuery.error;

  useEffect(() => {
    setGroups({});
    setPicks([]);
    setPredictionName('');
    savedNoticeShown.current = false;
    setLoadedKey('');
    setError('');
  }, [activeGroupId]);

  useEffect(() => {
    if (!saved || saved.key === loadedKey) return;
    setLoadedKey(saved.key);
    setGroups(saved.data?.groups ?? {});
    setPicks((saved.data?.customRounds ?? []).map((round) => round.map((pick) => pick ?? '')));
    setPredictionName(saved.predictionName ?? '');
    if (!activeGroupIsLocked && !savedNoticeShown.current) {
      savedNoticeShown.current = true;
      toast('Ya tienes un pronóstico guardado. Puedes cambiarlo hasta el cierre.', {
        id: 'custom-prediction-saved',
      });
    }
  }, [saved, loadedKey, activeGroupIsLocked]);

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
        .sort((left, right) => left.id - right.id)
        .map((match) => [match.home, match.away_team_id ? match.away : null]),
    [matches],
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
    setPicks((previous) => {
      const next = previous.slice(0, round + 1).map((items) => [...items]);
      next[round] ??= [];
      next[round][match] = name;
      return next;
    });
  };

  /** Coloca un equipo en un puesto del grupo y lo quita del puesto que ocupaba. */
  const selectGroupPosition = (group: string, position: number, name: string) => {
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
    return (
      <TeamSlot
        name={label}
        logo={name ? logos[name] : null}
        placeholder={!name}
        pressed={picked}
        onClick={
          editable && name && !slot.isBye && !lock.pickLocked(roundIndex, matchIndex)
            ? () => selectWinner(roundIndex, matchIndex, name)
            : undefined
        }
        rightContent={
          <PickOutcome
            picked={picked}
            won={Boolean(name && realWinners[roundIndex]?.has(name))}
            decided={Boolean(decidedRounds[roundIndex])}
          />
        }
      />
    );
  };

  const save = async () => {
    if (!activeGroupId || !firstRound.length) return;
    setError('');
    const orderedGroups: Record<string, string[]> = {};
    if (isFullBracket) {
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
    const championPick = completed[completed.length - 1]?.[0];
    if (!championPick) {
      setError('Elige un ganador en todos los cruces');
      return;
    }
    savedNoticeShown.current = true;
    setBusy(true);
    try {
      const data: PredictionData = {
        user: userName,
        prediction: predictionName.trim() || userName || 'Mi pronóstico',
        groups: orderedGroups,
        customRounds: completed,
        r16: [],
        champion: championPick,
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
    <section className="view-section active block" aria-label={`Pronóstico de ${activeGroupName}`}>
      {lateEntry && !lock.fullyLocked && (
        <p className="paper-panel album-sheet p-4 max-w-145 mx-auto text-center" role="status">
          La competición ya ha empezado: no se admiten pronósticos nuevos.
        </p>
      )}
      {editable && lock.anyLocked && (
        <p className="text-center text-muted text-[0.9rem] mb-[15px]">
          Lo que ya ha empezado está cerrado; el resto puedes cambiarlo.
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
            <h2 className="poster-title text-accent-text mt-0 mb-2.5 mx-0">
              Paso 1: fase de grupos
            </h2>
            <p className="text-muted">Ordena los equipos de cada grupo.</p>
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
            <h2 className="m-0 poster-title">
              {hasGroups ? 'Paso 2: Eliminatorias' : 'Eliminatorias'}
            </h2>
            {editable && firstRound.length > 0 && (
              <p className="text-muted mt-2 text-[0.9rem]">
                Pulsa un equipo para pasarlo a la siguiente ronda
              </p>
            )}
            {decidedRounds.some(Boolean) && (
              <p className="text-muted mt-1 text-[0.85rem]">
                <span className="text-[var(--hit)] font-bold">✓ Acertado</span> ·{' '}
                <span className="text-[var(--miss)] font-bold">✗ Fallado</span>
              </p>
            )}
          </div>

          {!firstRound.length && (
            <p className="paper-panel album-sheet p-5 text-center max-w-145 mx-auto">
              El administrador aún no ha configurado los cruces.
            </p>
          )}

          {layout.final && (
            <BracketCanvas
              leftRounds={layout.left.map((round) => round.map(toCanvasMatch))}
              rightRounds={layout.right.map((round) => round.map(toCanvasMatch))}
              roundLabels={layout.roundLabels}
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

          {firstRound.length > 0 && lock.configured && editable && (
            <div id="controls-section" className="paper-panel album-sheet landing-tape mt-7.5 p-5">
              <h3 className="mt-0 text-accent-text">Guardar pronóstico</h3>
              {error && (
                <p role="alert" className="text-[var(--miss)] mt-0">
                  {error}
                </p>
              )}
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
        </>
      )}
    </section>
  );
}

/** Marca de acierto o fallo; solo el icono, para no comerse el nombre en casillas estrechas. */
function PickOutcome({
  picked,
  won,
  decided,
}: {
  picked: boolean;
  won: boolean;
  decided: boolean;
}) {
  if (!picked || (!won && !decided)) return null;
  const label = won ? 'Acertado' : 'Fallado';
  return (
    <span
      className={`ml-1 shrink-0 text-[0.95em] font-bold ${won ? 'text-[var(--hit)]' : 'text-[var(--miss)]'}`}
      title={label}
    >
      <span aria-hidden="true">{won ? '✓' : '✗'}</span>
      <span className="sr-only"> {label}</span>
    </span>
  );
}
