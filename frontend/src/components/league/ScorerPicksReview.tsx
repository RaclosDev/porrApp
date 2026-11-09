import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompetitionPlayers, useScorerPick } from '../../hooks/useScorerPick';
import { fetchGroup } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { Group, ScorerPickView } from '../../types/api';
import { scorerPickSummary } from '../matchday/ScorerPickCard';

interface ScorerPicksReviewProps {
  groupId: number | string;
}

/**
 * Para el administrador: pichichis que no se han podido emparejar con un jugador (y los que él ya
 * asignó). Se resuelven desde que se cierra el plazo hasta que acaba la liga.
 */
export default function ScorerPicksReview({ groupId }: ScorerPicksReviewProps) {
  const { state, picks, assign } = useScorerPick(groupId, true);
  const reviewable = Boolean(state?.canResolve);
  // La liga ya suele estar en memoria (es la misma consulta que la de la liga activa).
  const { data: group } = useQuery<Partial<Group>>({
    queryKey: queryKeys.group(groupId),
    queryFn: () => fetchGroup(groupId),
    enabled: reviewable,
  });
  const { players } = useCompetitionPlayers(group?.competitionId ?? null, reviewable);
  const [chosen, setChosen] = useState<Record<number, string>>({});

  if (!state?.canResolve) return null;
  const pending = picks.filter((pick) => pick.canAssign);
  if (pending.length === 0) return null;

  const options = (pick: ScorerPickView) =>
    pick.candidates.length > 0 ? pick.candidates : players;

  return (
    <section className="md-scorer-review" aria-label="Pichichis por resolver">
      <h4>Pichichis por resolver</h4>
      <p className="text-muted">
        Indica a qué jugador se refiere cada participante: puntuará con él. Solo se puede hasta que
        acabe la liga.
      </p>
      {assign.isError && (
        <p className="md-scorer-note is-error" role="alert">
          {assign.error instanceof Error ? assign.error.message : 'No se pudo asignar el jugador'}
        </p>
      )}
      <ul>
        {pending.map((pick) => {
          const selectId = `scorer-review-${pick.predictionId}`;
          const value = chosen[pick.predictionId] ?? pick.playerId ?? '';
          return (
            <li key={pick.predictionId}>
              <span>
                <strong>{pick.participantName ?? 'Participante'}</strong>: «{pick.writtenName}»
                {pick.byAdmin ? ` · asignado a ${scorerPickSummary(pick)}` : ''}
              </span>
              <label htmlFor={selectId} className="sr-only">
                Jugador de {pick.participantName ?? 'participante'}
              </label>
              <select
                id={selectId}
                className="glass-input"
                value={value}
                onChange={(event) =>
                  setChosen((current) => ({ ...current, [pick.predictionId]: event.target.value }))
                }
              >
                <option value="">Elige jugador…</option>
                {options(pick).map((player) => (
                  <option key={player.playerId || player.name} value={player.playerId}>
                    {player.name}
                    {player.team ? ` (${player.team})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="glass-btn"
                disabled={!value || assign.isPending}
                onClick={() => assign.mutate({ predictionId: pick.predictionId, playerId: value })}
              >
                Asignar
              </button>
              {pick.byAdmin && (
                <button
                  type="button"
                  className="glass-btn"
                  disabled={assign.isPending}
                  onClick={() => assign.mutate({ predictionId: pick.predictionId, playerId: null })}
                >
                  Quitar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
