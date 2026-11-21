import { Link, useLocation } from 'react-router-dom';
import type { PokerSession } from '../../services/endpoints/poker';
import { shortDate } from './pokerFormat';
import { pokerRoutes } from './pokerRoutes';

/** Enlace a la mesa de un torneo concreto cuando la liga tiene varios programados. */
export const pokerTableLink = (session: PokerSession) =>
  `${pokerRoutes.table.to}?torneo=${session.id}`;

/**
 * Con varios torneos abiertos a la vez, una pestaña por torneo para pasar de uno a otro.
 * Marca en cuál está el jugador apuntado y cuál está en juego.
 */
export default function PokerSessionTabs({
  sessions,
  selectedId,
  myPlayerId,
}: {
  sessions: PokerSession[];
  selectedId: number | undefined;
  myPlayerId: number | null;
}) {
  const location = useLocation();
  if (sessions.length < 2) return null;
  // Se queda en la misma sección y conserva el resto de la dirección (p. ej. ?group=).
  const to = (session: PokerSession) => {
    const params = new URLSearchParams(location.search);
    params.set('torneo', String(session.id));
    return { pathname: location.pathname, search: `?${params}` };
  };
  return (
    <nav className="poker-session-tabs" aria-label="Torneos programados">
      {sessions.map((session) => {
        const selected = session.id === selectedId;
        const note =
          session.startedAt !== null
            ? 'En juego'
            : session.entries.some((entry) => entry.playerId === myPlayerId)
              ? 'Apuntado'
              : null;
        return (
          <Link
            key={session.id}
            to={to(session)}
            replace
            className={`poker-session-tab${selected ? ' is-active' : ''}`}
            aria-current={selected ? 'page' : undefined}
          >
            <span className="first-letter:uppercase">{shortDate(session.date)}</span>
            {note && <small>{note}</small>}
          </Link>
        );
      })}
    </nav>
  );
}
