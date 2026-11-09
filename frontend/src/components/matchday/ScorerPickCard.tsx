import { useState } from 'react';
import { useCompetitionPlayers, useScorerPick } from '../../hooks/useScorerPick';
import type { ScorerPickView } from '../../types/api';
import { findPlayer } from '../../utils/scorerPicks';
import ScorerInput from './ScorerInput';

interface ScorerPickCardProps {
  groupId: number | string;
  competitionId: number | null;
  /** Hay sesión: sin ella solo se ve el estado. */
  canEdit: boolean;
}

const WHEN = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });

/** Qué se sabe del jugador al que se refiere un pichichi. */
export function scorerPickSummary(pick: ScorerPickView): string {
  switch (pick.status) {
    case 'PLAYER':
    case 'MATCHED':
      return `${pick.playerName ?? pick.writtenName}${pick.team ? ` (${pick.team})` : ''}`;
    case 'DOUBTFUL':
      return `${pick.writtenName} · dudoso: el administrador de la liga lo resolverá`;
    default:
      return `${pick.writtenName} · se emparejará con un jugador cuando haya lista`;
  }
}

/**
 * Pichichi de una liga de fútbol por jornadas: se elige antes de que se cierre el plazo y cuenta al
 * acabar la liga. Pasado el plazo se ve el de todos.
 */
export default function ScorerPickCard({ groupId, competitionId, canEdit }: ScorerPickCardProps) {
  const { state, picks, save } = useScorerPick(groupId, true);
  const open = Boolean(state && !state.locked && canEdit);
  const { players } = useCompetitionPlayers(competitionId, open);
  const [draft, setDraft] = useState<string | null>(null);

  if (!state?.enabled || state.inBracket) return null;

  const mine = state.mine;
  const text = draft ?? mine?.writtenName ?? '';
  const dirty = draft != null && draft.trim() !== (mine?.writtenName ?? '');

  const submit = () => {
    const name = text.trim();
    const player = findPlayer(players, name);
    save.mutate(
      { name: player?.name ?? name, playerId: player?.playerId || null },
      { onSuccess: () => setDraft(null) },
    );
  };

  return (
    <section className="md-scorer" aria-label="Pichichi">
      <div className="md-scorer-head">
        <strong>Pichichi</strong>
        <span className="text-muted">
          {state.locked
            ? 'Plazo cerrado. Puntúa al acabar la liga.'
            : state.lockAt
              ? `Elígelo antes del ${WHEN.format(new Date(state.lockAt))}. Puntúa al acabar la liga.`
              : 'Elígelo antes de que empiece la liga. Puntúa al acabar la liga.'}
        </span>
      </div>
      {open && (
        <form
          className="md-scorer-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (dirty) submit();
          }}
        >
          <ScorerInput
            value={text}
            onChange={setDraft}
            players={players}
            disabled={save.isPending}
          />
          <button type="submit" className="glass-btn" disabled={!dirty || save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
      {save.isError && (
        <p className="md-scorer-note is-error" role="alert">
          {save.error instanceof Error ? save.error.message : 'No se pudo guardar el pichichi'}
        </p>
      )}
      {mine ? (
        <p className="md-scorer-note" role="status">
          Tu pichichi: {scorerPickSummary(mine)}
        </p>
      ) : (
        !open && <p className="md-scorer-note text-muted">No elegiste pichichi.</p>
      )}
      {state.locked && picks.length > 0 && (
        <details className="md-scorer-all">
          <summary>Pichichis de la liga ({picks.length})</summary>
          <ul>
            {picks.map((pick) => (
              <li key={pick.predictionId}>
                <strong>{pick.participantName ?? 'Participante'}</strong>
                <span>{scorerPickSummary(pick)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
