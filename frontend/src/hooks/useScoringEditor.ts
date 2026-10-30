import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLeagueScoring, updateLeagueScoring } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import type { ScoringRuleKey } from '../types/api';
import { draftToRules, sameRules, toDraft, type ScoringDraft } from '../utils/scoringRules';

/**
 * Puntuación de una liga lista para editar: el borrador del administrador, su validación y el
 * guardado. Mientras no se toca ningún campo, el borrador sigue a lo que devuelve el servidor.
 */
export function useScoringEditor(groupId: number | string, enabled: boolean) {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<ScoringDraft | null>(null);

  const query = useQuery({
    queryKey: queryKeys.leagueScoring(groupId),
    queryFn: () => fetchLeagueScoring(groupId),
    enabled: enabled && Boolean(groupId),
  });
  const scoring = query.data;

  const draft = edited ?? (scoring ? toDraft(scoring.rules) : null);
  const rules = draft && scoring ? draftToRules(draft, scoring.maxPoints) : null;
  const isValid = !edited || rules !== null;
  const isDirty = Boolean(edited && scoring && (!rules || !sameRules(rules, scoring.rules)));
  const isDefault = Boolean(rules && scoring && sameRules(rules, scoring.defaults));

  const mutation = useMutation({
    mutationFn: () => {
      if (!rules) throw new Error('Revisa los puntos: hay valores no válidos.');
      return updateLeagueScoring(groupId, rules);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.leagueScoring(groupId), saved);
      setEdited(null);
      // Los puntos se recalculan en el servidor con las reglas nuevas.
      [
        queryKeys.leaderboard(groupId),
        queryKeys.leaderboardMatchdays(groupId),
        queryKeys.matchdayFixtures(groupId),
        queryKeys.predictionScore(),
      ].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
  });

  return {
    scoring,
    isLoading: query.isLoading,
    error: query.error,
    draft,
    isDirty,
    isValid,
    isDefault,
    isSaving: mutation.isPending,
    setValue: (key: ScoringRuleKey, value: string) => {
      if (!draft) return;
      setEdited({ ...draft, [key]: value });
    },
    restoreDefaults: () => {
      if (scoring) setEdited(toDraft(scoring.defaults));
    },
    reset: () => setEdited(null),
    save: () => mutation.mutateAsync(),
  };
}

export type ScoringEditor = ReturnType<typeof useScoringEditor>;
