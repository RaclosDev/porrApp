import type { TrackerSession } from '../../services/endpoints/trackers';
import TrackerStandings from './TrackerStandings';
import { winnerLabel } from './trackerFormat';

interface Props {
  session: TrackerSession;
  gameName: string;
  unit: string;
  myPlayerId: number | null;
  busy: boolean;
  onAnother: () => void;
  onReopen: () => void;
  onCloseDay: () => void;
}

/** Al terminar una partida: quién la ha ganado, cómo ha quedado y qué se hace ahora. */
export default function TrackerResult({
  session,
  gameName,
  unit,
  myPlayerId,
  busy,
  onAnother,
  onReopen,
  onCloseDay,
}: Props) {
  return (
    <div className="tracker-result">
      <p className="tracker-result-label">
        {gameName} · partida {session.number}
      </p>
      <p className="tracker-result-winner" role="status">
        {winnerLabel(session)}
      </p>
      <TrackerStandings
        caption={`Cómo ha quedado la partida ${session.number}`}
        standings={session.standings}
        unit={unit}
        empty={session.rounds === 0}
        myPlayerId={myPlayerId}
      />
      <div className="tracker-actions tracker-result-actions">
        <button
          type="button"
          className="glass-btn primary-btn tracker-submit"
          disabled={busy}
          onClick={onAnother}
        >
          Otra partida
        </button>
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          disabled={busy}
          onClick={onCloseDay}
        >
          Cerrar el día
        </button>
        <button type="button" className="create-league-link" disabled={busy} onClick={onReopen}>
          Reabrir para corregir
        </button>
      </div>
    </div>
  );
}
