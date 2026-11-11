import type {
  TrackerGame,
  TrackerPlayer,
  TrackerRound,
  TrackerSession,
} from '../../services/endpoints/trackers';

interface Props {
  session: TrackerSession;
  game: Pick<TrackerGame, 'name' | 'mode'>;
  /** Quienes juegan la partida, en el orden de la liga. */
  players: TrackerPlayer[];
  /** Rondas de la partida, en orden. */
  rounds: TrackerRound[];
  /** Ronda que se está corrigiendo, para marcarla. */
  editingId?: number | null;
  busy?: boolean;
  /** Sin esto la hoja es de solo lectura: las rondas no se pueden tocar. */
  onPickRound?: (round: TrackerRound) => void;
}

/**
 * La tabla de la hoja: los totales arriba y una fila por ronda. El servidor numera las rondas en toda
 * la liga; aquí cuentan desde 1 en cada partida.
 */
export default function TrackerSheetTable({
  session,
  game,
  players,
  rounds,
  editingId,
  busy,
  onPickRound,
}: Props) {
  const wins = game.mode === 'WINS' || game.mode === 'DIRECT';
  const byRounds = wins || game.mode === 'ROUNDS';
  const totals = new Map(session.standings.map((row) => [row.playerId, row]));

  const cell = (round: TrackerRound, playerId: number) => {
    const points = round.scores[playerId];
    if (points === undefined) return <span aria-label="no jugó">–</span>;
    if (!wins) return points;
    return points > 0 ? <span aria-label="ganó">✓</span> : '';
  };

  return (
    <div className="tracker-table-wrap">
      <table className="tracker-table tracker-sheet-table">
        <caption className="sr-only">
          Hoja de la partida {session.number} de {game.name}
        </caption>
        <thead>
          <tr>
            <th scope="col">Ronda</th>
            {players.map((player) => (
              <th key={player.id} scope="col" className="is-num">
                {player.name}
              </th>
            ))}
          </tr>
          <tr className="tracker-sheet-total">
            <th scope="row">{byRounds ? 'Ganadas' : 'Total'}</th>
            {players.map((player) => {
              const row = totals.get(player.id);
              const leads = session.rounds > 0 && row?.rank === 1;
              return (
                <td key={player.id} className={`is-num${leads ? ' is-lead' : ''}`}>
                  {byRounds ? (row?.roundsWon ?? 0) : (row?.total ?? 0)}
                </td>
              );
            })}
          </tr>
          {game.mode === 'ROUNDS' && (
            <tr>
              <th scope="row">Total puntos</th>
              {players.map((player) => (
                <td key={player.id} className="is-num">
                  {totals.get(player.id)?.total ?? 0}
                </td>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rounds.length === 0 ? (
            <tr>
              <td colSpan={players.length + 1} className="tracker-note">
                Todavía no hay rondas.
              </td>
            </tr>
          ) : (
            rounds.map((serverRound, index) => {
              const round = { ...serverRound, number: index + 1 };
              return (
                <tr key={round.id} className={editingId === round.id ? 'is-editing' : undefined}>
                  <th scope="row">
                    {onPickRound ? (
                      <button
                        type="button"
                        className="tracker-round-link"
                        aria-label={`Corregir la ronda ${round.number}`}
                        disabled={busy}
                        onClick={() => onPickRound(round)}
                      >
                        <span>{round.number}</span>
                        <span className="tracker-round-edit">Editar</span>
                      </button>
                    ) : (
                      round.number
                    )}
                  </th>
                  {players.map((player) => (
                    <td key={player.id} className="is-num">
                      {cell(round, player.id)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
