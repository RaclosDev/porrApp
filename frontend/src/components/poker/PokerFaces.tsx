import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { UserAvatar } from '../Avatar';
import ZoomableAvatar from '../ZoomableAvatar';
import type { PokerPlayer } from '../../services/endpoints/poker';

const Faces = createContext<Map<number, PokerPlayer>>(new Map());

export type OpenPokerProfile = (player: { playerId: number; name: string }) => void;

/** Lo da `PokerProfiles`: abre el cromo de un jugador con sus números en la liga. */
export const PokerProfileContext = createContext<OpenPokerProfile | null>(null);

/** Abre el cromo de un jugador; fuera de una liga de póker no hay perfil que abrir. */
export const usePokerProfile = () => useContext(PokerProfileContext);

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
  zoomable = false,
  photoOnly = false,
}: {
  playerId: number;
  name: string;
  size?: number;
  /** Pulsarla abre el cromo del jugador; sin cromo a mano, amplía la foto. */
  zoomable?: boolean;
  /** Ya dentro del cromo: pulsarla solo amplía la foto. */
  photoOnly?: boolean;
}) {
  const face = useContext(Faces).get(playerId);
  const openProfile = useContext(PokerProfileContext);
  if (zoomable && openProfile && !photoOnly)
    return (
      <button
        type="button"
        className="sheet-person-photo"
        onClick={(event) => {
          event.stopPropagation();
          openProfile({ playerId, name });
        }}
        aria-label={`Ver el perfil de ${name}`}
      >
        <UserAvatar
          url={face?.avatarUrl}
          name={name}
          userId={face?.userId ?? `poker-${playerId}`}
          size={size}
        />
      </button>
    );
  if (zoomable || photoOnly)
    return (
      <ZoomableAvatar
        url={face?.avatarUrl}
        name={name}
        userId={face?.userId ?? `poker-${playerId}`}
        size={size}
      />
    );
  return (
    <UserAvatar
      url={face?.avatarUrl}
      name={name}
      userId={face?.userId ?? `poker-${playerId}`}
      size={size}
    />
  );
}
