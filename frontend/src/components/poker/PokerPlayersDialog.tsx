import PeopleListDialog from '../PeopleListDialog';
import { PokerAvatar } from './PokerFaces';
import { PokerPlayerName } from './PokerPlayerCard';
import type { PokerPlayer } from '../../services/endpoints/poker';

/**
 * Los jugadores de la liga de póker en la misma hoja que los participantes de las porras, con los
 * invitados sin cuenta marcados; al pulsar uno se abre su ficha de póker.
 */
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
  const people = [...players]
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    .map((player) => ({
      key: player.id,
      userId: player.userId,
      name: player.name,
      avatarUrl: player.avatarUrl ?? null,
      badge: player.guest ? 'Invitado' : undefined,
      avatar: <PokerAvatar playerId={player.id} name={player.name} size={36} zoomable />,
      label: (
        <PokerPlayerName className="sheet-person-name" playerId={player.id} name={player.name} />
      ),
    }));
  return (
    <PeopleListDialog
      title="Jugadores"
      subtitle={leagueName}
      intro={`${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'}: ${members} con cuenta y ${guests} ${guests === 1 ? 'invitado' : 'invitados'}`}
      people={people}
      onClose={onClose}
    />
  );
}
