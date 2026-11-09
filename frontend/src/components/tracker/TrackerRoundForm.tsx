import { useState, type FormEvent } from 'react';
import type { Tracker } from '../../services/endpoints/trackers';

interface Props {
  tracker: Tracker;
  busy: boolean;
  onSubmit: (round: { note: string; scores: Record<string, number> }) => Promise<boolean>;
}

const MAX_POINTS = 1_000_000;

/** Apunta una partida: los puntos de cada jugador (en blanco, 0) o una victoria con un toque. */
export default function TrackerRoundForm({ tracker, busy, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const scores: Record<string, number> = {};
    for (const player of tracker.players) {
      const raw = (values[player.id] ?? '').trim();
      if (!raw) continue;
      const points = Number(raw);
      if (!Number.isInteger(points) || Math.abs(points) > MAX_POINTS) {
        setError(`Los puntos de ${player.name} tienen que ser un número entero.`);
        return;
      }
      scores[player.id] = points;
    }
    if (Object.keys(scores).length === 0) {
      setError('Escribe los puntos de al menos un jugador.');
      return;
    }
    setError('');
    if (await onSubmit({ note, scores })) {
      setValues({});
      setNote('');
    }
  };

  return (
    <section className="tracker-section" aria-labelledby="tracker-round-title">
      <h2 id="tracker-round-title" className="tracker-heading">
        Apuntar partida
      </h2>
      <form onSubmit={handleSubmit} noValidate className="tracker-round-form">
        <div className="tracker-round-grid">
          {tracker.players.map((player) => (
            <div key={player.id} className="tracker-round-row">
              <label htmlFor={`tracker-points-${player.id}`}>{player.name}</label>
              <input
                id={`tracker-points-${player.id}`}
                className="glass-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={values[player.id] ?? ''}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [player.id]: event.target.value }))
                }
              />
              <button
                type="button"
                className="glass-btn tracker-win-btn"
                disabled={busy}
                aria-label={`Victoria de ${player.name}: 1 ${tracker.unit}`}
                onClick={() => void onSubmit({ note: '', scores: { [player.id]: 1 } })}
              >
                +1
              </button>
            </div>
          ))}
        </div>
        <div className="create-league-field">
          <label htmlFor="tracker-note">Nota (opcional)</label>
          <input
            id="tracker-note"
            className="glass-input"
            maxLength={120}
            autoComplete="off"
            placeholder="Por ejemplo: la del mus"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        {error && (
          <p className="create-league-error is-block" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="glass-btn primary-btn tracker-submit" disabled={busy}>
          {busy ? 'Apuntando…' : 'Apuntar partida'}
        </button>
      </form>
    </section>
  );
}
