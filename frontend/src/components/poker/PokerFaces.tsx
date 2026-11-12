import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { UserAvatar } from '../Avatar';
import type { PokerPlayer } from '../../services/endpoints/poker';

const Faces = createContext<Map<number, PokerPlayer>>(new Map());

/** Reparte las fotos de la plantilla a cualquier vista de la liga, que solo conoce el id de jugador. */
export function PokerFaces({ players, children }: { players: PokerPlayer[]; children: ReactNode }) {
  const faces = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  return <Faces.Provider value={faces}>{children}</Faces.Provider>;
}

/** Foto del jugador; los invitados y quien no tiene foto salen con sus letras a rotulador. */
export function PokerAvatar({
  playerId,
  name,
  size = 36,
}: {
  playerId: number;
  name: string;
  size?: number;
}) {
  const face = useContext(Faces).get(playerId);
  return (
    <UserAvatar
      url={face?.avatarUrl}
      name={name}
      userId={face?.userId ?? `poker-${playerId}`}
      size={size}
    />
  );
}
