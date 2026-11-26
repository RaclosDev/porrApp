import { X } from 'lucide-react';
import {
  setPokerAttendance,
  type PokerLeagueData,
  type PokerSession,
} from '../../services/endpoints/poker';
import { confirmAction } from '../../utils/confirmAction';
import PokerLateEntry from './PokerLateEntry';
import { PokerAvatar } from './PokerFaces';
import { euros } from './pokerFormat';

interface Props {
  league: PokerLeagueData;
  session: PokerSession;
  busy: boolean;
  change: (request: () => Promise<PokerLeagueData>) => Promise<boolean>;
}

/** Jugadores de la mesa en juego: quien organiza sienta a quien llega y saca a quien se apuntó por error. */
export default function PokerLivePlayers({ league, session, busy, change }: Props) {
  const out = new Set(session.eliminations);
  const last = session.entries.length <= 1;

  async function remove(playerId: number, name: string, paidCents: number) {
    const confirmed = await confirmAction({
      title: `¿Quitar a ${name} de la mesa?`,
      message: `Sale del torneo y su dinero (${euros(paidCents)}) deja de contar en el bote.`,
      confirmLabel: 'Quitar de la mesa',
    });
    if (confirmed) await change(() => setPokerAttendance(league.id, session.id, false, playerId));
  }

  const { buyInCents, rebuy, addOn } = session.settings;
  return (
    <fieldset className="poker-live-players">
      <legend>Jugadores · {session.entries.length}</legend>
      <ul className="poker-late-list">
        {session.entries.map((entry) => {
          const paid =
            buyInCents +
            (rebuy?.costCents ?? 0) * entry.rebuys +
            (addOn?.costCents ?? 0) * entry.addOns;
          return (
            <li key={entry.playerId}>
              <PokerAvatar playerId={entry.playerId} name={entry.name} size={36} />
              <span>
                <span className="poker-late-name">{entry.name}</span>
                {out.has(entry.playerId) && <small>Eliminado</small>}
              </span>
              <button
                type="button"
                className="glass-btn poker-live-remove"
                aria-label={`Quitar a ${entry.name} de la mesa`}
                disabled={busy || last}
                onClick={() => void remove(entry.playerId, entry.name, paid)}
              >
                <X size={16} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <PokerLateEntry league={league} session={session} busy={busy} change={change} />
    </fieldset>
  );
}
