import { useState } from 'react';
import TrackerAddPlayer from '../tracker/TrackerAddPlayer';
import {
  addPokerGuest,
  pokerCommand,
  setPokerAttendance,
  type PokerLeagueData,
  type PokerSession,
} from '../../services/endpoints/poker';
import { confirmAction } from '../../utils/confirmAction';
import { PokerAvatar } from './PokerFaces';
import { chips, euros, upcomingTournamentDate } from './pokerFormat';

interface Props {
  league: PokerLeagueData;
  session: PokerSession;
  busy: boolean;
  change: (request: () => Promise<PokerLeagueData>) => Promise<boolean>;
  onEdit: () => void;
}

export default function PokerRegistration({ league, session, busy, change, onEdit }: Props) {
  const [addingGuest, setAddingGuest] = useState(false);
  const confirmed = new Set(session.entries.map((entry) => entry.playerId));
  const playing = league.myPlayerId !== null && confirmed.has(league.myPlayerId);
  const count = confirmed.size;
  const full = count >= 20;
  const prizesFit = session.settings.prizeShares.length <= count;
  const canStart = count >= 2 && prizesFit;

  async function cancel() {
    if (
      await confirmAction({
        title: '¿Cancelar este torneo?',
        message: 'Se borrarán las inscripciones de esta fecha.',
        confirmLabel: 'Cancelar torneo',
      })
    ) {
      await change(() => pokerCommand(league.id, session, 'CANCEL'));
    }
  }

  function addGuest(name: string) {
    return change(() => addPokerGuest(league.id, session.id, name));
  }

  return (
    <section className="paper-panel album-sheet poker-panel poker-registration">
      <div className="poker-section-head">
        <div>
          <h2>Inscripciones abiertas</h2>
          <p className="poster-title poker-big-date">{upcomingTournamentDate(session.date)}</p>
        </div>
        {league.myPlayerId !== null && (
          <button
            type="button"
            className={playing ? 'glass-btn' : 'glass-btn primary-btn'}
            disabled={busy || (!playing && full)}
            onClick={() => void change(() => setPokerAttendance(league.id, session.id, !playing))}
          >
            {playing ? 'Desapuntarme' : 'Apuntarme'}
          </button>
        )}
      </div>
      {playing && (
        <p role="status" className="marker-ink poker-state">
          Asistencia confirmada
        </p>
      )}
      <dl className="poker-metrics">
        <div>
          <dt>Confirmados</dt>
          <dd>{count} / 20</dd>
        </div>
        <div>
          <dt>Entrada</dt>
          <dd>{euros(session.settings.buyInCents)}</dd>
        </div>
        <div>
          <dt>Fichas iniciales</dt>
          <dd>{chips(session.settings.startingChips)}</dd>
        </div>
        <div>
          <dt>Bote de premios</dt>
          <dd>{euros(session.potCents)}</dd>
        </div>
      </dl>
      <p className="poker-note">
        Reparto ·{' '}
        {session.settings.prizeShares.map((share, i) => `${i + 1}.º ${share} %`).join(' · ')}
      </p>
      <div className="poker-roster">
        <h3>{league.owner ? 'Jugadores de la liga' : 'Jugadores confirmados'}</h3>
        {league.owner ? (
          <ul className="poker-player-list poker-pick-list">
            {league.players.map((player) => (
              <li key={player.id}>
                <label className="poker-check">
                  <input
                    type="checkbox"
                    aria-label={player.guest ? `${player.name} (invitado)` : undefined}
                    checked={confirmed.has(player.id)}
                    disabled={busy || (full && !confirmed.has(player.id))}
                    onChange={(event) => {
                      const attending = event.target.checked;
                      void change(() =>
                        setPokerAttendance(league.id, session.id, attending, player.id),
                      );
                    }}
                  />
                  <PokerAvatar playerId={player.id} name={player.name} size={40} />
                  <span>
                    {player.name}
                    {player.guest && <small>Invitado</small>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : count > 0 ? (
          <ul className="poker-faces">
            {session.entries.map((entry) => (
              <li key={entry.playerId}>
                <PokerAvatar playerId={entry.playerId} name={entry.name} size={48} />
                <span>{entry.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="poker-note">Aún no hay confirmaciones.</p>
        )}
      </div>
      {league.owner && (
        <>
          <button
            type="button"
            className="glass-btn poker-guest-toggle"
            aria-expanded={addingGuest}
            disabled={busy || full}
            onClick={() => setAddingGuest(!addingGuest)}
          >
            {addingGuest ? 'Cerrar formulario' : 'Añadir invitado sin cuenta'}
          </button>
          {addingGuest && <TrackerAddPlayer busy={busy || full} onAddPlayer={addGuest} />}
          <div className="poker-host">
            {!canStart && (
              <p className="poker-note">
                {count < 2
                  ? 'Hacen falta al menos dos jugadores para empezar.'
                  : 'Reduce los puestos premiados o confirma a más jugadores para empezar.'}
              </p>
            )}
            <div className="poker-actions poker-host-actions">
              <button
                type="button"
                className="glass-btn primary-btn"
                disabled={busy || !canStart}
                onClick={() => void change(() => pokerCommand(league.id, session, 'START'))}
              >
                Empezar torneo
              </button>
              <button type="button" className="glass-btn" disabled={busy} onClick={onEdit}>
                Editar torneo
              </button>
              <button
                type="button"
                className="glass-btn poker-out-btn"
                disabled={busy}
                onClick={() => void cancel()}
              >
                Cancelar torneo
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
