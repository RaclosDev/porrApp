import { useState } from 'react';
import { Users } from 'lucide-react';
import SheetDialog from '../SheetDialog';
import PokerFreeTable from './PokerFreeTable';
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
import { chips, euros, maxEntries, upcomingTournamentDate } from './pokerFormat';

interface Props {
  league: PokerLeagueData;
  session: PokerSession;
  busy: boolean;
  change: (request: () => Promise<PokerLeagueData>) => Promise<boolean>;
  onEdit: () => void;
}

export default function PokerRegistration({ league, session, busy, change, onEdit }: Props) {
  const [addingGuest, setAddingGuest] = useState(false);
  const [managing, setManaging] = useState(false);
  const confirmed = new Set(session.entries.map((entry) => entry.playerId));
  const playing = league.myPlayerId !== null && confirmed.has(league.myPlayerId);
  const count = confirmed.size;
  const full = count >= maxEntries(league);
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
    <>
      <PokerFreeTable
        className="poker-next-card poker-registration"
        heading={
          <>
            <span className="sr-only">Inscripciones abiertas:</span>{' '}
            {upcomingTournamentDate(session.date)}
          </>
        }
        title={null}
        sides={[
          <dl key="players" className="poker-wall-metric">
            <dt>Confirmados</dt>
            <dd>
              {count} / {maxEntries(league)}
            </dd>
          </dl>,
          <dl key="money" className="poker-wall-metric">
            <dt>Entrada</dt>
            <dd>{euros(session.settings.buyInCents)}</dd>
          </dl>,
        ]}
      >
        <p className="marker-ink poker-state" role={playing ? 'status' : undefined}>
          {playing ? 'Asistencia confirmada' : 'Inscripciones abiertas'}
        </p>
        <dl className="poker-felt-facts">
          <div>
            <dt>Fichas iniciales</dt>
            <dd>{chips(session.settings.startingChips)}</dd>
          </div>
          <div>
            <dt>Bote de premios</dt>
            <dd>{euros(session.potCents)}</dd>
          </div>
        </dl>
        <div className="poker-split">
          <span>Reparto</span>
          <ul aria-label="Reparto del bote">
            {session.settings.prizeShares.map((share, index) => (
              <li key={index}>
                {index + 1}.º · {share} %
              </li>
            ))}
          </ul>
        </div>
        {count > 0 ? (
          <ul className="poker-faces" aria-label="Jugadores confirmados">
            {session.entries.map((entry) => (
              <li key={entry.playerId}>
                <PokerAvatar playerId={entry.playerId} name={entry.name} size={48} zoomable />
                <span>{entry.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="poker-note">Aún no hay confirmaciones.</p>
        )}
        <div className="poker-next-actions">
          {league.myPlayerId !== null && (
            <button
              type="button"
              className={playing ? 'glass-btn' : 'glass-btn primary-btn'}
              disabled={busy || (!playing && full)}
              onClick={() => void change(() => setPokerAttendance(league.id, session.id, !playing))}
            >
              {playing ? 'Desapuntarme' : 'Apuntarme al torneo'}
            </button>
          )}
          {league.owner && (
            <button
              type="button"
              className="glass-btn"
              aria-haspopup="dialog"
              disabled={busy}
              onClick={() => setManaging(true)}
            >
              <Users size={15} strokeWidth={2.25} aria-hidden="true" />
              Jugadores
            </button>
          )}
        </div>
        {league.owner && (
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
        )}
      </PokerFreeTable>
      {league.owner && managing && (
        <SheetDialog
          title="Jugadores de la liga"
          subtitle={`Marca quién juega este torneo (${count} / ${maxEntries(league)}).`}
          onClose={() => {
            setManaging(false);
            setAddingGuest(false);
          }}
        >
          <div className="sheet-dialog-body">
            <ul className="poker-player-list poker-pick-list">
              {league.players.map((player) => (
                <li key={player.id}>
                  <label className="poker-check">
                    <input
                      type="checkbox"
                      aria-label={player.guest ? `${player.name} (invitado)` : player.name}
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
          </div>
        </SheetDialog>
      )}
    </>
  );
}
