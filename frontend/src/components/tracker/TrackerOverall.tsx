import { useState } from 'react';
import type { Tracker } from '../../services/endpoints/trackers';
import TrackerStandings from './TrackerStandings';
import { standingsFrom, yearOf } from './seasonStandings';

interface Props {
  tracker: Tracker;
}

/**
 * Clasificación general de la liga, o la de un juego con su ficha: quién lo gana más. Si se ha
 * jugado más de un año, se puede ver la de cada temporada.
 */
export default function TrackerOverall({ tracker }: Props) {
  const [gameId, setGameId] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const played = (tracker.games ?? []).filter((game) => game.sessions > 0);
  const game = played.find((item) => item.id === gameId) ?? null;
  const gameYear = (session: (typeof tracker.sessions)[number]) => yearOf(session, tracker.days);
  const years = [...new Set(tracker.sessions.filter((item) => item.rounds > 0).map(gameYear))].sort(
    (a, b) => b - a,
  );
  const season = years.includes(year ?? NaN) ? year : null;
  const standings =
    season != null
      ? standingsFrom(
          tracker.sessions.filter(
            (item) => gameYear(item) === season && (!game || item.gameId === game.id),
          ),
          tracker.rounds,
        )
      : game
        ? (tracker.byGame?.find((item) => item.gameId === game.id)?.standings ?? [])
        : tracker.overall;

  const best = Math.max(0, ...standings.map((row) => row.sessionsWon));
  const leaders = standings.filter((row) => best > 0 && row.sessionsWon === best);
  const filteredSessions = tracker.sessions.filter(
    (item) => (!game || item.gameId === game.id) && (season == null || gameYear(item) === season),
  );
  const roundCount = filteredSessions.reduce((total, item) => total + item.rounds, 0);

  return (
    <>
      {years.length > 1 && (
        <div className="tracker-chips tracker-filter" role="group" aria-label="Temporada">
          {[null, ...years].map((item) => (
            <button
              key={item ?? 'all'}
              type="button"
              className={`tracker-chip${item === season ? ' is-on' : ''}`}
              aria-pressed={item === season}
              onClick={() => setYear(item)}
            >
              {item ?? 'Siempre'}
            </button>
          ))}
        </div>
      )}
      {played.length > 0 && (
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
          <strong>{game.name}</strong>: {filteredSessions.length}{' '}
          {filteredSessions.length === 1 ? 'partida' : 'partidas'} y {roundCount}{' '}
          {roundCount === 1 ? 'ronda' : 'rondas'}.{' '}
          {leaders.length === 0
            ? 'Todavía nadie ha ganado una partida.'
            : `Quien más lo gana: ${leaders.map((row) => row.name).join(' y ')} (${best}).`}
        </p>
      )}
      <p className="tracker-note">
        Ordenado por partidas ganadas. Las rondas ganadas se cuentan por separado; las partidas
        abiertas aún no suman victorias.
      </p>
      <TrackerStandings
        caption={`${game ? `Clasificación de ${game.name}` : 'Clasificación general'}${
          season != null ? ` en ${season}` : ''
        }`}
        standings={standings}
        unit={game?.unit ?? tracker.unit}
        showSessions
        showTotal={Boolean(game)}
        empty={
          season != null
            ? standings.length === 0
            : game
              ? game.rounds === 0
              : tracker.rounds.length === 0
        }
        myPlayerId={tracker.myPlayerId}
      />
    </>
  );
}
