import { Link } from 'react-router-dom';
import { Dices } from 'lucide-react';
import type { TrackerSummary } from '../../services/endpoints/trackers';
import type { Group } from '../../types/api';
import { LeagueAvatar } from '../Avatar';
import { scoreboardPath } from '../../utils/scoreboardLeague';

interface Props {
  tracker: TrackerSummary;
  /** Es la liga activa. */
  isSelected?: boolean;
  /** La misma liga vista como liga (imagen, reglas, código), para las acciones de la tarjeta. */
  group?: Group;
  onShare?: (group: Group) => void;
  onRules?: (group: Group) => void;
  onMembers?: (group: Group) => void;
}

/** Fila de una liga de juegos de mesa en «Mis ligas», con el mismo aspecto que la de una liga. */
export default function TrackerCard({
  tracker,
  isSelected = false,
  group,
  onShare,
  onRules,
  onMembers,
}: Props) {
  const players = `${tracker.players} ${tracker.players === 1 ? 'jugador' : 'jugadores'}`;
  const rounds = `${tracker.rounds} ${tracker.rounds === 1 ? 'partida' : 'partidas'}`;

  return (
    <li
      className={`paper-panel album-sheet list-none min-w-0 !p-0${isSelected ? ' border-2 border-[var(--ink)]' : ''}`}
    >
      <Link
        to={scoreboardPath(tracker.id)}
        aria-current={isSelected ? 'true' : undefined}
        className="flex items-center gap-3 p-3.5 text-inherit no-underline rounded-[8px] min-h-11"
        aria-label={`Abrir el marcador ${tracker.name}`}
      >
        {group?.imageUrl ? (
          <LeagueAvatar url={group.imageUrl} name={tracker.name} size={44} />
        ) : (
          <span className="tracker-card-icon" aria-hidden="true">
            <Dices size={24} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            className="block poster-title text-[1.05rem] leading-tight overflow-hidden text-ellipsis whitespace-nowrap"
            title={tracker.name}
          >
            {tracker.name}
          </span>
          <span className="block text-muted text-[0.78rem] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
            {tracker.owner ? 'Administras' : 'Invitado'} · Juego de mesa
          </span>
          <span className="block mt-1 text-[0.8rem] font-bold">
            {players} · {rounds}
          </span>
        </span>
      </Link>
      {group && (
        <div className="flex gap-2 px-3 pb-3">
          {group.joinCode && onShare && (
            <button
              type="button"
              className="glass-btn flex-1 py-2 px-3 text-[0.85rem] whitespace-nowrap"
              aria-label={`Invitar a ${tracker.name} por WhatsApp`}
              onClick={() => onShare(group)}
            >
              Invitar
            </button>
          )}
          {onRules && (
            <button
              type="button"
              className="glass-btn flex-1 py-2 px-3 text-[0.85rem] whitespace-nowrap"
              aria-label={`Reglas de ${tracker.name}`}
              onClick={() => onRules(group)}
            >
              Reglas
            </button>
          )}
          {onMembers && (
            <button
              type="button"
              className="glass-btn flex-1 py-2 px-3 text-[0.85rem] whitespace-nowrap"
              aria-label={
                tracker.owner ? `Administrar ${tracker.name}` : `Miembros de ${tracker.name}`
              }
              onClick={() => onMembers(group)}
            >
              {tracker.owner ? 'Administrar' : 'Miembros'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
