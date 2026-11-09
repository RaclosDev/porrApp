import { useEffect, useRef } from 'react';
import { fetchMyPredictions, getAuthToken } from '../services/api';
import { readGroupsDraft, readThirdsDraft, writeDraft } from '../utils/drafts';
import {
  extractGroupsFromR32,
  hasValidGroupSelections,
  normalizeGroupsDraft,
  reconstructBracketState,
  storedFirstRound,
  type GroupSelection,
} from '../utils/bracketDraft';
import { isEmptyBracket } from '../utils/bracketEditor';
import type { BracketState } from '../store/useAppStore';
import type { GroupOdds, PredictionSummary, TournamentFormat } from '../types/api';

interface HydrationInput {
  isAuthenticated: boolean;
  activeGroupId: string;
  userId: string;
  userName: string;
  topScorer: string;
  bracketState: BracketState;
  groupOdds: GroupOdds | undefined;
  /** Forma del torneo de la liga, o `null` mientras no se sabe: hasta entonces no se vuelca nada. */
  format: TournamentFormat | null;
  participantsHashes: PredictionSummary[];
  setBracketState: (state: BracketState) => void;
  setTopScorer: (scorer: string) => void;
  setUserName: (name: string) => void;
  setPredictionName: (update: (previous: string) => string) => void;
  setSavedPredictionId: (id: string | null) => void;
  setSavedGroupsDraft: (groups: Record<string, GroupSelection>) => void;
  setSavedThirdsDraft: (thirds: string[]) => void;
}

/**
 * Vuelca al editor la porra ya guardada de la liga, una sola vez por liga y usuario: volver a
 * hidratar pisaría lo que el usuario lleva editado. Un borrador local sin guardar manda.
 */
export function useSavedBracketHydration(input: HydrationInput) {
  const { isAuthenticated, activeGroupId, userId, setBracketState, setTopScorer, setUserName } =
    input;
  const format = input.format;

  // Valores que la hidratación consulta al llegar la respuesta, sin volver a lanzarla.
  const latestRef = useRef(input);
  useEffect(() => {
    latestRef.current = input;
  });

  // Liga (y usuario) cuya porra guardada ya se ha volcado al editor.
  const hydratedScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!(isAuthenticated || Boolean(getAuthToken())) || !activeGroupId || !format) return;
    const scope = `${userId}:${activeGroupId}`;
    if (hydratedScopeRef.current === scope) return;
    hydratedScopeRef.current = scope;
    const groupId = activeGroupId;
    let cancelled = false;
    let settled = false;

    fetchMyPredictions()
      .then((predictions) => {
        settled = true;
        // Si ha cambiado la liga mientras llegaba la respuesta, no es de esta liga.
        if (cancelled || !Array.isArray(predictions)) return;
        const latest = latestRef.current;
        let current = predictions.find((b) => b.groupId?.toString() === groupId);
        if (!current && latest.participantsHashes.length > 0) {
          if (userId) {
            current = latest.participantsHashes.find((p) => p.userId?.toString() === userId);
          } else if (latest.userName) {
            const matches = latest.participantsHashes.filter(
              (p) =>
                p.userId == null &&
                p.participantName?.toLowerCase() === latest.userName.toLowerCase(),
            );
            if (matches.length === 1) current = matches[0];
          }
        }
        if (!current) return;

        latest.setSavedPredictionId(current.key || null);
        if (current.participantName && !latest.userName) setUserName(current.participantName);
        const predictionTitle = current.predictionName;
        if (predictionTitle) latest.setPredictionName((prev) => prev || predictionTitle);
        const currentData = current.data;
        if (!currentData) return;
        if (currentData.scorer && !latest.topScorer) setTopScorer(currentData.scorer);

        let norm = normalizeGroupsDraft(currentData.groups);
        let normThirds = Array.isArray(currentData.thirds) ? currentData.thirds : [];
        const firstRound = storedFirstRound(currentData, format);
        if (!hasValidGroupSelections(norm) && firstRound) {
          const extracted = extractGroupsFromR32(
            firstRound,
            latest.groupOdds,
            currentData.topologyVersion,
            format,
          );
          norm = extracted.groups;
          if (normThirds.length === 0) normThirds = extracted.thirds;
        }

        // Un borrador local sin guardar manda sobre lo que hay en el servidor.
        if (
          hasValidGroupSelections(norm) &&
          !hasValidGroupSelections(readGroupsDraft(groupId, userId))
        ) {
          latest.setSavedGroupsDraft(norm);
          writeDraft('groups', groupId, userId, norm);
        }
        if (normThirds.length > 0 && readThirdsDraft(groupId, userId) === undefined) {
          latest.setSavedThirdsDraft(normThirds);
          writeDraft('advancing', groupId, userId, normThirds);
        }
        const hydrated = reconstructBracketState(currentData, format);
        if (hydrated && isEmptyBracket(latest.bracketState)) {
          setBracketState(hydrated);
        }
      })
      .catch((err) => {
        settled = true;
        // Sin respuesta no se ha hidratado nada: se reintentará la próxima vez.
        if (hydratedScopeRef.current === scope) hydratedScopeRef.current = null;
        console.error(err);
      });

    return () => {
      cancelled = true;
      // Una petición cortada a medias no cuenta como hidratada.
      if (!settled && hydratedScopeRef.current === scope) hydratedScopeRef.current = null;
    };
  }, [userId, activeGroupId, isAuthenticated, format, setBracketState, setTopScorer, setUserName]);
}
