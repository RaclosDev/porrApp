import { useState } from 'react';
import SheetDialog from '../SheetDialog';
import TrackerAddPlayer from '../tracker/TrackerAddPlayer';
import {
  addPokerGuest,
  setPokerAttendance,
  type PokerLeagueData,
  type PokerSession,
} from '../../services/endpoints/poker';
import { PokerAvatar } from './PokerFaces';
import { euros } from './pokerFormat';

interface Props {
  league: PokerLeagueData;
  session: PokerSession;
  busy: boolean;
  change: (request: () => Promise<PokerLeagueData>) => Promise<boolean>;
}

/** Suma a la mesa ya empezada a quien llega tarde: el organizador a cualquiera, el resto a sí mismo. */
export default function PokerLateEntry({ league, session, busy, change }: Props) {
  const [open, setOpen] = useState(false);
  const seated = new Set(session.entries.map((entry) => entry.playerId));
  const full = seated.size >= 20;
  const meOut = league.myPlayerId !== null && !seated.has(league.myPlayerId);
  const waiting = league.players.filter((player) => !seated.has(player.id));
  if (full || (!league.owner && !meOut)) return null;

  const join = (playerId?: number) =>
    change(() => setPokerAttendance(league.id, session.id, true, playerId));

  if (!league.owner) {
    return (
      <div className="poker-actions poker-late-entry">
        <button type="button" className="glass-btn" disabled={busy} onClick={() => void join()}>
          Unirme a la mesa · {euros(session.settings.buyInCents)}
        </button>
      </div>
    );
  }

  return (
    <div className="poker-actions poker-late-entry">
      <button
        type="button"
        className="glass-btn"
        aria-haspopup="dialog"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Añadir jugador
      </button>
      {open && (
        <SheetDialog
          title="Añadir jugador"
          subtitle={`Entra con las fichas iniciales y paga ${euros(session.settings.buyInCents)} de entrada.`}
          onClose={() => setOpen(false)}
        >
          <div className="sheet-dialog-body">
            {waiting.length > 0 && (
              <ul className="poker-late-list" aria-label="Jugadores de la liga">
                {waiting.map((player) => (
                  <li key={player.id}>
                    <PokerAvatar playerId={player.id} name={player.name} size={36} />
                    <span>
                      {player.name}
                      {player.guest && <small>Invitado</small>}
                    </span>
                    <button
                      type="button"
                      className="glass-btn primary-btn"
                      aria-label={`Sentar a ${player.name}`}
                      disabled={busy}
                      onClick={() => void join(player.id).then((ok) => ok && setOpen(false))}
                    >
                      Sentar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <TrackerAddPlayer
              busy={busy}
              label="Invitado sin cuenta"
              onAddPlayer={async (name) => {
                const ok = await change(() => addPokerGuest(league.id, session.id, name));
                if (ok) setOpen(false);
                return ok;
              }}
            />
          </div>
        </SheetDialog>
      )}
    </div>
  );
}
