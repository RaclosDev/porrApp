import type { Tracker } from '../../services/endpoints/trackers';

interface Props {
  tracker: Tracker;
  busy: boolean;
  onClaim: (playerId: number) => Promise<boolean>;
  onRelease: () => Promise<boolean>;
}

/** Quien entra con su cuenta dice cuál de los jugadores es, y así se ve quién es quién en cada móvil. */
export default function TrackerIdentity({ tracker, busy, onClaim, onRelease }: Props) {
  const mine = tracker.players.find((player) => player.id === tracker.myPlayerId);
  const free = tracker.players.filter(
    (player) => !tracker.claimedPlayerIds.includes(player.id) || player.id === tracker.myPlayerId,
  );

  return (
    <section
      className="paper-panel album-sheet tracker-section"
      aria-labelledby="tracker-identity-title"
    >
      <h2 id="tracker-identity-title" className="tracker-heading">
        ¿Quién eres?
      </h2>
      {mine ? (
        <p className="tracker-note">
          Juegas como <strong>{mine.name}</strong>.{' '}
          <button
            type="button"
            className="create-league-link"
            disabled={busy}
            onClick={() => void onRelease()}
          >
            Quitarme
          </button>
        </p>
      ) : (
        <p className="tracker-note">Elige tu nombre para que se te vea en la clasificación.</p>
      )}
      <div className="tracker-actions">
        {free
          .filter((player) => player.id !== tracker.myPlayerId)
          .map((player) => (
            <button
              key={player.id}
              type="button"
              className="glass-btn create-league-small-btn"
              disabled={busy}
              onClick={() => void onClaim(player.id)}
            >
              Soy {player.name}
            </button>
          ))}
      </div>
    </section>
  );
}
