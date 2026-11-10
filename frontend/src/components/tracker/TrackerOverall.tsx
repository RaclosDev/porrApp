import { useState } from 'react';
import type { Tracker } from '../../services/endpoints/trackers';
import TrackerStandings from './TrackerStandings';

interface Props {
  tracker: Tracker;
}

/** Clasificación general de la liga, o la de un juego con su ficha: quién lo gana más. */
export default function TrackerOverall({ tracker }: Props) {
  const [gameId, setGameId] = useState<number | null>(null);
  const played = (tracker.games ?? []).filter((game) => game.sessions > 0);
  const game = played.find((item) => item.id === gameId) ?? null;
  const standings = game
    ? (tracker.byGame?.find((item) => item.gameId === game.id)?.standings ?? [])
    : tracker.overall;

  const best = Math.max(0, ...standings.map((row) => row.sessionsWon));
  const leaders = standings.filter((row) => best > 0 && row.sessionsWon === best);

  return (
    <>
      {played.length > 1 && (
        <div
          className="tracker-chips tracker-filter"
          role="group"
          aria-label="Ver la clasificación de"
        >
          {[null, ...played].map((item) => (
            <button
              key={item?.id ?? 'all'}
              type="button"
              className={`tracker-chip${(item?.id ?? null) === (game?.id ?? null) ? ' is-on' : ''}`}
              aria-pressed={(item?.id ?? null) === (game?.id ?? null)}
              onClick={() => setGameId(item?.id ?? null)}
            >
              {item?.name ?? 'Todos los juegos'}
            </button>
          ))}
        </div>
      )}
      {game && (
        <p className="tracker-game-card" role="status">
          <strong>{game.name}</strong>: {game.sessions}{' '}
          {game.sessions === 1 ? 'partida' : 'partidas'} y {game.rounds}{' '}
          {game.rounds === 1 ? 'ronda' : 'rondas'}.{' '}
          {leaders.length === 0
            ? 'Todavía nadie ha ganado una partida.'
            : `Quien más lo gana: ${leaders.map((row) => row.name).join(' y ')} (${best}).`}
        </p>
      )}
      <TrackerStandings
        caption={game ? `Clasificación de ${game.name}` : 'Clasificación general'}
        standings={standings}
        unit={game?.unit ?? tracker.unit}
        showSessions
        empty={game ? game.rounds === 0 : tracker.rounds.length === 0}
        myPlayerId={tracker.myPlayerId}
      />
    </>
  );
}
