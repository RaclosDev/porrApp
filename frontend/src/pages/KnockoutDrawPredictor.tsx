import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import { useCustomLock } from '../hooks/useCustomLock';
import { createPrediction } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import {
  knockoutPrediction,
  logosOf,
  picksFromSaved,
  type KnockoutPicks,
} from '../utils/knockoutDraw';
import KnockoutDrawBoard from '../components/knockout/KnockoutDrawBoard';
import PaperLoading from '../components/PaperLoading';
import InkStamp from '../components/InkStamp';

/**
 * Predicción de unas eliminatorias que se sortean ronda a ronda (Champions, Copa del Rey…): tras cada
 * sorteo se elige quién pasa cada cruce. Se guarda sola y cada ronda se cierra al empezar.
 */
export default function KnockoutDrawPredictor() {
  const { activeGroupId, activeGroupName, activeGroupIsLocked, allGames, userName } =
    useAppContext();
  const saved = useMyLeaguePrediction();
  const lock = useCustomLock(activeGroupId);
  const rounds = useMemo(() => lock.state?.knockoutRounds ?? [], [lock.state]);
  const queryClient = useQueryClient();
  const [picks, setPicks] = useState<KnockoutPicks>([]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState('');
  const failedRevision = useRef(-1);
  const [loadedKey, setLoadedKey] = useState('');

  useEffect(() => {
    setPicks([]);
    setRevision(0);
    setError('');
    setLastSaved('');
    setLoadedKey('');
    failedRevision.current = -1;
  }, [activeGroupId]);

  // Se cargan las elecciones guardadas una vez se conocen los cruces, sin pisar lo que se esté cambiando.
  useEffect(() => {
    if (revision > 0 || rounds.length === 0) return;
    const key = `${saved?.key ?? ''}:${rounds.map((round) => round.ties.length).join(',')}`;
    if (key === loadedKey) return;
    setLoadedKey(key);
    setPicks(picksFromSaved(rounds, saved?.data?.customRounds));
  }, [saved, rounds, loadedKey, revision]);

  const logos = useMemo(() => logosOf(allGames), [allGames]);
  const editable = !activeGroupIsLocked && !lock.fullyLocked;
  const data = useMemo(
    () => knockoutPrediction(rounds, picks, userName, saved?.predictionName ?? ''),
    [rounds, picks, userName, saved?.predictionName],
  );

  const choose = (round: number, tie: number, team: string | null) => {
    setRevision((value) => value + 1);
    setError('');
    setPicks((current) => {
      const next = rounds.map((item, index) =>
        item.ties.map((_, position) => current[index]?.[position] ?? null),
      );
      next[round][tie] = team;
      return next;
    });
  };

  useEffect(() => {
    if (!revision || !editable || !activeGroupId || !data || busy) return;
    const fingerprint = JSON.stringify(data);
    if (fingerprint === lastSaved || failedRevision.current === revision) return;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void createPrediction(data, activeGroupId)
        .then(async () => {
          setLastSaved(fingerprint);
          setError('');
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.myPredictions() }),
            queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(activeGroupId) }),
          ]);
        })
        .catch((reason: unknown) => {
          failedRevision.current = revision;
          setError(errorMessage(reason, 'No se pudo guardar la predicción'));
        })
        .finally(() => setBusy(false));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeGroupId, busy, data, editable, lastSaved, queryClient, revision]);

  const saving = busy || (data != null && revision > 0 && JSON.stringify(data) !== lastSaved);

  return (
    <section className="view-section active block" aria-label={`Predicción de ${activeGroupName}`}>
      <div className="section-header mb-5 text-center">
        <h2 className="m-0 poster-title">Eliminatorias</h2>
        <p className="text-muted mt-2 text-[0.9rem]">
          Tras cada sorteo, pulsa el equipo que crees que pasa en cada cruce. A ida y vuelta cuenta
          quién pasa, no cada partido.
        </p>
      </div>

      {editable && revision > 0 && (
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
          ) : saving ? (
            'Guardando…'
          ) : data ? (
            '✓ Guardado'
          ) : null}
        </p>
      )}

      {(activeGroupIsLocked || lock.fullyLocked) && (
        <p className="flex items-center justify-center gap-3 mb-[15px] text-[0.9rem] text-muted">
          <InkStamp>Predicción cerrada</InkStamp>
          Ya ha empezado la final.
        </p>
      )}

      {!lock.state && <PaperLoading label="Cargando cruces…" />}
      {lock.state && rounds.length === 0 && (
        <p className="paper-panel album-sheet p-5 text-center max-w-145 mx-auto">
          Aún no se han sorteado los cruces: podrás hacer tu predicción en cuanto se conozcan.
        </p>
      )}
      {rounds.length > 0 && (
        <KnockoutDrawBoard
          rounds={rounds}
          matches={allGames}
          logos={logos}
          picks={picks}
          onPick={editable ? choose : undefined}
          isLocked={lock.pickLocked}
        />
      )}
    </section>
  );
}
