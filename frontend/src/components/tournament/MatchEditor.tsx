import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  TournamentMatch,
  OrganizedTournament,
} from '../../services/endpoints/organizedTournaments';

export type TournamentUpdate = (
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  data?: object,
) => Promise<boolean>;

export default function MatchEditor({
  match,
  tournament,
  update,
  busy,
  close,
}: {
  match: TournamentMatch;
  tournament: OrganizedTournament;
  update: TournamentUpdate;
  busy: boolean;
  close: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '');
  const [outcome, setOutcome] = useState<string>(match.outcome ?? '');
  const date = match.scheduledAt ? new Date(match.scheduledAt) : null;
  const [scheduledAt, setScheduledAt] = useState(
    date
      ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : '',
  );
  const [venue, setVenue] = useState(match.venue ?? '');
  const name = (id: string | null) =>
    tournament.participants.find((p) => p.id === id)?.name ?? 'Por decidir';
  const home = name(match.homeId),
    away = name(match.awayId);
  const ready = match.homeId && match.awayId && !match.bye;
  async function saveResult(event: FormEvent) {
    event.preventDefault();
    if (
      await update(`matches/${match.id}/result`, 'PUT', {
        homeScore: homeScore === '' ? null : Number(homeScore),
        awayScore: awayScore === '' ? null : Number(awayScore),
        outcome: outcome || null,
      })
    )
      close();
  }
  return (
    <div className="tournament-editor">
      <h3 ref={heading} tabIndex={-1}>
        {home} — {away}
      </h3>
      {ready && (
        <form onSubmit={(event) => void saveResult(event)}>
          <div className="tournament-fields">
            <label>
              Marcador de {home}
              <input
                className="glass-input"
                type="number"
                min={0}
                max={1000000}
                value={homeScore}
                onChange={(event) => {
                  setHomeScore(event.target.value);
                  setOutcome('');
                }}
              />
            </label>
            <label>
              Marcador de {away}
              <input
                className="glass-input"
                type="number"
                min={0}
                max={1000000}
                value={awayScore}
                onChange={(event) => {
                  setAwayScore(event.target.value);
                  setOutcome('');
                }}
              />
            </label>
          </div>
          <label>
            Resultado
            <select
              className="glass-input"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            >
              <option value="">Según el marcador</option>
              <option value="HOME">Gana {home}</option>
              <option value="AWAY">Gana {away}</option>
              {tournament.format !== 'KNOCKOUT' && <option value="DRAW">Empate</option>}
            </select>
          </label>
          <p className="text-muted">
            Puedes dejar los marcadores vacíos y elegir el ganador. Si hay empate en una
            eliminatoria, indica quién ganó el desempate.
          </p>
          <div className="tournament-actions">
            <button className="glass-btn primary-btn" disabled={busy}>
              Guardar resultado
            </button>
            {match.outcome && (
              <button
                className="glass-btn"
                type="button"
                disabled={busy}
                onClick={() =>
                  void update(`matches/${match.id}/result`, 'PUT', {
                    homeScore: null,
                    awayScore: null,
                    outcome: null,
                  }).then((saved) => {
                    if (saved) close();
                  })
                }
              >
                Borrar resultado
              </button>
            )}
          </div>
        </form>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void update(`matches/${match.id}`, 'PUT', {
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
            venue,
          }).then((saved) => {
            if (saved) close();
          });
        }}
      >
        <div className="tournament-fields">
          <label>
            Fecha y hora local
            <input
              className="glass-input"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
          </label>
          <label>
            Lugar o mesa
            <input
              className="glass-input"
              value={venue}
              maxLength={120}
              onChange={(event) => setVenue(event.target.value)}
            />
          </label>
        </div>
        <button className="glass-btn" disabled={busy}>
          Guardar horario
        </button>
      </form>
      <button className="glass-btn" onClick={close} disabled={busy}>
        Cerrar edición
      </button>
    </div>
  );
}
