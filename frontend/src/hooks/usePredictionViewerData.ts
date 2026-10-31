import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPrediction } from '../services/api';
import { officialBracketQuery, predictionScoreQuery } from '../services/queries';
import { checkIsKnockoutPhase, injectQualifiedTeams, normalizePart } from '../utils/predictionData';
import {
  EMPTY_OFFICIAL_BRACKET,
  bracketSides,
  r32Source,
  selectViewerPoints,
  type RoundRef,
} from '../utils/predictionViewer';
import {
  centerPointsTotal,
  groupTeamData,
  roundFooterTotal,
  slotDetails,
} from '../utils/viewerScoring';
import type {
  GroupOdds,
  GroupStandings,
  Match,
  ParticipantScore,
  PredictionData,
} from '../types/api';
import { errorMessage } from '../utils/errors';

export type { RoundRef } from '../utils/predictionViewer';

/**
 * Carga y prepara lo que necesita el visor de la porra de un usuario: el pronóstico, el cuadro
 * oficial y los puntos. Devuelve funciones ya enlazadas a esos datos para pintar cada hueco.
 *
 * @param leaderboardData - Ranking de la liga; da los puntos mientras llega el desglose.
 * @param allGames - Partidos oficiales, para saber quién ha caído.
 * @param initialPart - Porra ya disponible (lista de participantes) para pintarla al instante.
 */
export function usePredictionViewerData(
  viewerPredictionId: string | number | null,
  officialPoints: GroupStandings,
  leaderboardData: ParticipantScore[],
  groupOdds: GroupOdds,
  allGames: Match[],
  initialPart: PredictionData | null = null,
) {
  const [rawPart, setRawPart] = useState<PredictionData | null>(() => initialPart || null);
  const [partLoading, setPartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuadro oficial compartido con el resto de la app; el WebSocket lo invalida.
  const officialQuery = useQuery({
    ...officialBracketQuery(),
    enabled: Boolean(viewerPredictionId),
  });
  const rawOfficialBracket =
    officialQuery.data ?? (officialQuery.isError ? EMPTY_OFFICIAL_BRACKET : null);
  const loading = partLoading || (Boolean(viewerPredictionId) && officialQuery.isPending);

  const part = useMemo(() => normalizePart(rawPart, groupOdds), [rawPart, groupOdds]);

  const officialBracket = useMemo(
    () => injectQualifiedTeams(rawOfficialBracket, officialPoints),
    [rawOfficialBracket, officialPoints],
  );

  const initialSection = useMemo(
    () => (checkIsKnockoutPhase(allGames, officialBracket) ? 'knockout' : 'groups'),
    [allGames, officialBracket],
  );

  useEffect(() => {
    let cancelled = false;

    if (!viewerPredictionId) {
      setRawPart(null);
      setError(null);
      setPartLoading(false);
      return undefined;
    }

    const hasInitialPart = Boolean(initialPart);
    setError(null);
    if (hasInitialPart) {
      setRawPart(initialPart);
      setPartLoading(false);
    } else {
      setPartLoading(true);
    }

    const partPromise = hasInitialPart
      ? Promise.resolve(null)
      : fetchPrediction(viewerPredictionId);

    partPromise
      .then((partData) => {
        if (cancelled) return;
        if (partData) setRawPart(partData);
        setPartLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(errorMessage(err, 'No se pudo cargar la porra'));
        setPartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewerPredictionId, initialPart]);

  const isPending = loading || (!part && !error && Boolean(viewerPredictionId));
  const partReady = Boolean(part);

  // El desglose completo (log, aciertos exactos) se pide en segundo plano: el visor ya está pintado.
  const { data: detailedScore } = useQuery({
    ...predictionScoreQuery(viewerPredictionId ?? ''),
    enabled: Boolean(viewerPredictionId) && partReady,
  });

  const points = useMemo(
    () =>
      selectViewerPoints(
        detailedScore && String(detailedScore.id) === String(viewerPredictionId)
          ? detailedScore
          : null,
        leaderboardData,
        viewerPredictionId,
        part?.user,
      ),
    [detailedScore, leaderboardData, viewerPredictionId, part?.user],
  );

  const { leftRounds, rightRounds } = useMemo(() => bracketSides(r32Source(part), part), [part]);

  const slotContext = { part, points, officialBracket, officialPoints, allGames };

  return {
    part,
    loading: isPending,
    error,
    points,
    initialSection,
    leftRounds,
    rightRounds,
    getSlotDetails: (name: string | null | undefined, roundIndex: RoundRef) =>
      slotDetails(name, roundIndex, slotContext),
    getRoundFooterTotal: (roundIndex: number, side: 'left' | 'right') =>
      roundFooterTotal(
        (side === 'left' ? leftRounds : rightRounds)[roundIndex],
        roundIndex,
        part,
        points,
      ),
    getCenterPointsTotal: () => centerPointsTotal(points),
    getGroupTeamData: (groupName: string, teamName: string, expectedPos: number) =>
      groupTeamData(groupName, teamName, expectedPos, points, officialPoints, groupOdds),
  };
}
