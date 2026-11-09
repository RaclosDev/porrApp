import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import { createPrediction } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import {
  computeCustomBracketRounds,
  customRoundMatchIndex,
  splitCustomRounds,
  type CustomBracketMatchSlot,
} from '../utils/customBracket';
import {
  bracketResults,
  completeCustomPrediction,
  firstRoundPairs,
  teamsByGroup,
} from '../utils/customBracketPrediction';
import { useCustomBracketData } from '../hooks/useCustomBracketData';
import CustomGroupsPicker from '../components/customBracket/CustomGroupsPicker';
import { useCustomLock } from '../hooks/useCustomLock';
import PaperLoading from '../components/PaperLoading';
import InkStamp from '../components/InkStamp';
import BracketCanvas, { TeamSlot, type CanvasMatch } from '../components/BracketCanvas';
import { BracketFinalMatch } from '../components/BracketFinale';
import BracketTeamStatus from '../components/BracketTeamStatus';
import { useUnsavedChanges } from '../utils/unsavedChanges';

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

  const {
    matches,
    logos,
    teams,
    loading: loadingData,
    error: loadError,
  } = useCustomBracketData(activeGroupId, official, allGames);

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

  const groupTeams = useMemo(() => teamsByGroup(teams), [teams]);
  const firstRound = useMemo(() => firstRoundPairs(matches, official), [matches, official]);
  const { realWinners, eliminatedAt, decidedRounds } = useMemo(
    () => bracketResults(matches),
    [matches],
  );

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
  const hasGroups = isFullBracket && Object.keys(groupTeams).length > 0;
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
      const size = groupTeams[group]?.length ?? 0;
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

  const completeData = useMemo(
    () =>
      completeCustomPrediction({
        firstRound,
        picks,
        groups,
        teamsByGroup: groupTeams,
        isFullBracket,
        userName,
        predictionName,
      }),
    [firstRound, groups, isFullBracket, picks, predictionName, groupTeams, userName],
  );

  // Incompleta no se guarda; completa, tarda un instante en llegar al servidor.
  const unsaved =
    editable &&
    lock.configured &&
    revision > 0 &&
    (completeData ? JSON.stringify(completeData) : null) !== lastSaved;
  useUnsavedChanges(
    unsaved,
    completeData
      ? 'Tus últimos cambios aún no se han guardado.'
      : 'La predicción no se guarda hasta completar el cuadro: si sales, pierdes lo elegido.',
  );

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
          setError(errorMessage(reason, 'No se pudo guardar la predicción'));
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
    <section className="view-section active block" aria-label={`Predicción de ${activeGroupName}`}>
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
          La competición ya ha empezado: no se admiten predicciones nuevas.
        </p>
      )}
      {(activeGroupIsLocked || lock.fullyLocked) && (
        <p className="flex items-center justify-center gap-3 mb-[15px] text-[0.9rem] text-muted">
          <InkStamp>Predicción cerrada</InkStamp>
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
        <CustomGroupsPicker
          teamsByGroup={groupTeams}
          groups={groups}
          logos={logos}
          canEdit={(group) => editable && !lock.groupLocked(group)}
          onSelect={selectGroupPosition}
        />
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
            {/* Lo elegido ya se ve en el cuadro; la leyenda solo explica los colores de acierto. */}
            {picks.some((round) => round.some(Boolean)) && decidedRounds.some(Boolean) && (
              <ul className="pick-legend" aria-label="Leyenda del cuadro">
                <li>
                  <span className="pick-legend-swatch is-hit" aria-hidden="true" />
                  Acertada
                </li>
                <li>
                  <span className="pick-legend-swatch is-miss" aria-hidden="true" />
                  Fallada
                </li>
              </ul>
            )}
          </div>

          {!firstRound.length && (
            <p className="paper-panel album-sheet p-5 text-center max-w-145 mx-auto">
              {official
                ? 'Aún no hay cruces del cuadro: podrás hacer tu predicción cuando termine la fase previa.'
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
              El administrador debe fijar el cierre antes de que se puedan guardar predicciones.
            </p>
          )}
        </>
      )}
    </section>
  );
}
