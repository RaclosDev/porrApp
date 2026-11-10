import { Link } from 'react-router-dom';
import { Dices } from 'lucide-react';
import type { TrackerSummary } from '../../services/endpoints/trackers';
import { scoreboardPath } from '../../utils/scoreboardLeague';

interface Props {
  tracker: TrackerSummary;
  /** Es la liga activa. */
  isSelected?: boolean;
}

/** Fila de una liga de juegos de mesa en «Mis ligas», con el mismo aspecto que la de una liga. */
export default function TrackerCard({ tracker, isSelected = false }: Props) {
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
        <span className="tracker-card-icon" aria-hidden="true">
          <Dices size={24} />
        </span>
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
    </li>
  );
}
