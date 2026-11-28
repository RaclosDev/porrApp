import SheetDialog from '../SheetDialog';
import { PokerAvatar } from './PokerFaces';
import { PokerPlayerName } from './PokerPlayerCard';
import type { PokerPlayer } from '../../services/endpoints/poker';

const byName = (a: PokerPlayer, b: PokerPlayer) =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

/** Los jugadores de la liga de póker, con o sin cuenta; al pulsar uno se abre su ficha. */
export default function PokerPlayersDialog({
  players,
  leagueName,
  onClose,
}: {
  players: PokerPlayer[];
  leagueName: string;
  onClose: () => void;
}) {
  const guests = players.filter((player) => player.guest).length;
  const members = players.length - guests;
  const sorted = [...players].sort(byName);
  return (
    <SheetDialog title="Jugadores" subtitle={leagueName} onClose={onClose}>
      <div className="sheet-dialog-body">
        <p className="sheet-dialog-intro">
          {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}: {members} con cuenta y{' '}
          {guests} {guests === 1 ? 'invitado' : 'invitados'}
        </p>
        <ul className="sheet-people">
          {sorted.map((player) => (
            <li key={player.id} className="sheet-person">
              <PokerAvatar playerId={player.id} name={player.name} size={36} zoomable />
              <PokerPlayerName
                className="sheet-person-name"
                playerId={player.id}
                name={player.name}
              />
              {player.guest && <span className="sheet-person-badge">Invitado</span>}
            </li>
          ))}
        </ul>
      </div>
    </SheetDialog>
  );
}
