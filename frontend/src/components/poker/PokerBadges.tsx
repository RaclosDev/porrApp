import type { PokerSession } from '../../services/endpoints/poker';
import { PokerAvatar } from './PokerFaces';

/** Ganadores (empates incluidos) del último torneo cerrado. */
export function lastWinnerIds(sessions: PokerSession[] | undefined) {
  const last = sessions
    ?.filter((session) => session.closedAt !== null)
    .reduce<PokerSession | null>(
      (latest, session) => (!latest || session.closedAt! > latest.closedAt! ? session : latest),
      null,
    );
  return (
    last?.results.filter((result) => result.place === 1).map((result) => result.playerId) ?? []
  );
}

/** Bala por recompra, bolsa por add-on y corona para quien ganó el último torneo. */
export function SeatBadges({
  rebuys = 0,
  addOns = 0,
  crowned = false,
}: {
  rebuys?: number;
  addOns?: number;
  crowned?: boolean;
}) {
  return (
    <>
      {crowned && (
        <svg className="poker-seat-crown" viewBox="0 0 24 16">
          <path d="M2 14 1 3l6 5 5-7 5 7 6-5-1 11Z" />
        </svg>
      )}
      {rebuys > 0 && (
        <span className="poker-seat-bullet">
          <svg viewBox="0 0 8 22">
            <path className="bullet-tip" d="M4 0C1.6 2.5 1 5 1 8.6h6C7 5 6.4 2.5 4 0Z" />
            <rect className="bullet-case" x="1" y="8.4" width="6" height="11" rx="0.5" />
            <rect className="bullet-rim" x="0.4" y="19.3" width="7.2" height="2.7" rx="0.6" />
            <path className="bullet-shine" d="M2.3 9.5h1v9h-1Z" />
          </svg>
          {rebuys > 1 && <b>{rebuys}</b>}
        </span>
      )}
      {addOns > 0 && (
        <span className="poker-seat-bag">
          <svg viewBox="0 0 20 22">
            <path d="M7 1h6l-2 4H9Z" />
            <path d="M8 6h4c4.5 2.5 7 7 7 10.5 0 3-2.5 4.5-6 4.5H7c-3.5 0-6-1.5-6-4.5C1 13 3.5 8.5 8 6Z" />
            <text x="10" y="18" textAnchor="middle">
              €
            </text>
          </svg>
          {addOns > 1 && <b>{addOns}</b>}
        </span>
      )}
    </>
  );
}

/** Foto con sus iconos encima, para cromos y listas de caras. */
export function BadgedAvatar({
  playerId,
  name,
  size,
  ...badges
}: {
  playerId: number;
  name: string;
  size: number;
  rebuys?: number;
  addOns?: number;
  crowned?: boolean;
}) {
  return (
    <span className="poker-badged">
      <PokerAvatar playerId={playerId} name={name} size={size} />
      <SeatBadges {...badges} />
    </span>
  );
}
