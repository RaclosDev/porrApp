import type { TrackerStanding } from '../../services/endpoints/trackers';

interface Props {
  caption: string;
  standings: TrackerStanding[];
  unit: string;
  /** La columna de partidas ganadas solo tiene sentido en la clasificación acumulada. */
  showSessions?: boolean;
  showTotal?: boolean;
  /** Sin partidas aún nadie va primero. */
  empty: boolean;
  /** Jugador que es el usuario, para marcarlo en la tabla. */
  myPlayerId?: number | null;
}

/** Clasificación: posición con empates, total y rondas (y partidas) ganadas. */
export default function TrackerStandings({
  caption,
  standings,
  unit,
  showSessions,
  showTotal = true,
  empty,
  myPlayerId,
}: Props) {
  return (
    <div className="tracker-table-wrap">
      <table className="tracker-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Jugador</th>
            {showTotal && (
              <th scope="col" className="is-num">
                {unit}
              </th>
            )}
            <th scope="col" className="is-num">
              Rondas ganadas
            </th>
            {showSessions && (
              <th scope="col" className="is-num">
                Partidas ganadas
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.playerId} className={!empty && row.rank === 1 ? 'is-leader' : undefined}>
              <td>{empty ? '–' : row.rank}</td>
              <th scope="row">
                {row.name}
                {row.playerId === myPlayerId && (
                  <>
                    {' '}
                    <span className="tracker-me">(tú)</span>
                  </>
                )}
              </th>
              {showTotal && <td className="is-num">{row.total}</td>}
              <td className="is-num">{row.roundsWon}</td>
              {showSessions && <td className="is-num">{row.sessionsWon}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
