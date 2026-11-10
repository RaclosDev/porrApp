import { useState, type FormEvent } from 'react';
import type {
  TrackerGame,
  TrackerPlayer,
  TrackerRound,
  TrackerRoundDraft,
  TrackerSession,
} from '../../services/endpoints/trackers';
import TrackerSheetTable from './TrackerSheetTable';

interface Props {
  session: TrackerSession;
  game: Pick<TrackerGame, 'name' | 'unit' | 'mode' | 'lowerWins'>;
  /** Quienes juegan la partida, en el orden de la liga. */
  players: TrackerPlayer[];
  rounds: TrackerRound[];
  busy: boolean;
  onAdd: (round: TrackerRoundDraft) => Promise<boolean>;
  onEdit: (roundId: number, round: TrackerRoundDraft) => Promise<boolean>;
  onDelete: (round: TrackerRound) => Promise<boolean>;
}

const MAX_POINTS = 1_000_000;

/**
 * La hoja de la partida: los totales arriba y una fila por ronda. Debajo se apunta la siguiente ronda
 * (los puntos de cada uno, o un toque en quien la gana) y tocando una ronda se corrige.
 */
export default function TrackerSheet({
  session,
  game,
  players,
  rounds,
  busy,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<TrackerRound | null>(null);
  const [error, setError] = useState('');
  const wins = game.mode === 'WINS';

  const reset = () => {
    setValues({});
    setEditing(null);
    setError('');
  };

  const startEditing = (round: TrackerRound) => {
    setEditing(round);
    setError('');
    setValues(
      Object.fromEntries(
        Object.entries(round.scores).map(([playerId, points]) => [playerId, String(points)]),
      ),
    );
  };

  const save = async (draft: TrackerRoundDraft) => {
    const done = editing ? await onEdit(editing.id, draft) : await onAdd(draft);
    if (done) reset();
  };

  const submitPoints = async (event: FormEvent) => {
    event.preventDefault();
    const scores: Record<string, number> = {};
    for (const player of players) {
      const raw = (values[player.id] ?? '').trim();
      if (!raw) continue;
      const points = Number(raw);
      if (!Number.isInteger(points) || Math.abs(points) > MAX_POINTS) {
        setError(`Los ${game.unit} de ${player.name} tienen que ser un número entero.`);
        return;
      }
      scores[player.id] = points;
    }
    if (Object.keys(scores).length === 0) {
      setError('Escribe lo que ha sacado al menos un jugador.');
      return;
    }
    setError('');
    await save({ scores, sessionId: session.id });
  };

  return (
    <div className="tracker-sheet">
      <TrackerSheetTable
        session={session}
        game={game}
        players={players}
        rounds={rounds}
        editingId={editing?.id}
        busy={busy}
        onPickRound={startEditing}
      />

      <section className="tracker-entry" aria-labelledby="tracker-entry-title">
        <h3 id="tracker-entry-title" className="tracker-heading">
          {editing ? `Corregir la ronda ${editing.number}` : `Ronda ${rounds.length + 1}`}
        </h3>
        {wins ? (
          <div className="tracker-chips" role="group" aria-label="¿Quién gana la ronda?">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                className={`tracker-chip is-big${editing && editing.scores[player.id] > 0 ? ' is-on' : ''}`}
                disabled={busy}
                onClick={() => void save({ winners: [player.id], sessionId: session.id })}
              >
                Gana {player.name}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={submitPoints} noValidate>
            <div className="tracker-round-grid">
              {players.map((player) => (
                <div key={player.id} className="tracker-round-row">
                  <label htmlFor={`tracker-points-${player.id}`}>{player.name}</label>
                  <input
                    id={`tracker-points-${player.id}`}
                    className="glass-input"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="–"
                    value={values[player.id] ?? ''}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [player.id]: event.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <p className="tracker-note">En blanco, no jugó esa ronda.</p>
            {error && (
              <p className="create-league-error is-block" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="glass-btn primary-btn tracker-submit" disabled={busy}>
              {editing ? 'Guardar la ronda' : 'Apuntar ronda'}
            </button>
          </form>
        )}
        {editing && (
          <div className="tracker-actions">
            <button
              type="button"
              className="create-league-link"
              disabled={busy}
              onClick={() => void onDelete(editing).then((done) => done && reset())}
            >
              Borrar la ronda
            </button>
            <button type="button" className="create-league-link" onClick={reset}>
              Cancelar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
