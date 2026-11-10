import { useState } from 'react';
import type { Tracker } from '../../services/endpoints/trackers';
import { percent, playerProfile } from './playerProfile';

/** Ficha de cada jugador: partidas, victorias, racha, cómo le va en cada juego y contra cada rival. */
export default function TrackerProfile({ tracker }: { tracker: Tracker }) {
  const first = tracker.myPlayerId ?? tracker.players[0]?.id ?? null;
  const [playerId, setPlayerId] = useState<number | null>(first);
  const player = tracker.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;
  const profile = playerProfile(tracker, player.id);

  return (
    <section className="paper-panel album-sheet tracker-section" aria-labelledby="tracker-profile">
      <h2 id="tracker-profile" className="tracker-heading">
        Ficha de jugador
      </h2>
      <label htmlFor="tracker-profile-player" className="sr-only">
        Jugador
      </label>
      <select
        id="tracker-profile-player"
        className="glass-input tracker-select"
        value={player.id}
        onChange={(event) => setPlayerId(Number(event.target.value))}
      >
        {tracker.players.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
            {option.id === tracker.myPlayerId ? ' (tú)' : ''}
          </option>
        ))}
      </select>

      {profile.played === 0 ? (
        <p className="tracker-note">{player.name} aún no ha terminado ninguna partida.</p>
      ) : (
        <>
          <dl className="tracker-profile-stats">
            <div>
              <dt>Partidas</dt>
              <dd>{profile.played}</dd>
            </div>
            <div>
              <dt>Ganadas</dt>
              <dd>
                {profile.won} <small>({percent(profile.won, profile.played)})</small>
              </dd>
            </div>
            <div>
              <dt>Racha</dt>
              <dd>{profile.streak}</dd>
            </div>
            <div>
              <dt>Mejor racha</dt>
              <dd>{profile.bestStreak}</dd>
            </div>
          </dl>

          <h3 className="tracker-subheading">Por juego</h3>
          <div className="tracker-table-wrap">
            <table className="tracker-table">
              <thead>
                <tr>
                  <th scope="col">Juego</th>
                  <th scope="col">Jugadas</th>
                  <th scope="col">Ganadas</th>
                </tr>
              </thead>
              <tbody>
                {profile.games.map((game) => (
                  <tr key={game.gameId}>
                    <th scope="row">{game.name}</th>
                    <td>{game.played}</td>
                    <td>
                      {game.won} ({percent(game.won, game.played)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {profile.rivals.length > 0 && (
            <>
              <h3 className="tracker-subheading">Cara a cara</h3>
              <div className="tracker-table-wrap">
                <table className="tracker-table">
                  <thead>
                    <tr>
                      <th scope="col">Contra</th>
                      <th scope="col">Juntos</th>
                      <th scope="col">Gana {player.name}</th>
                      <th scope="col">Pierde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.rivals.map((rival) => (
                      <tr key={rival.playerId}>
                        <th scope="row">{rival.name}</th>
                        <td>{rival.together}</td>
                        <td>{rival.won}</td>
                        <td>{rival.lost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
