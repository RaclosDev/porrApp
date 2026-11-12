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

/** Bala de recompra: punta de cobre y casquillo de latón. */
export function BulletIcon() {
  return (
    <svg className="poker-icon poker-icon-bullet" viewBox="0 0 8 22" aria-hidden="true">
      <path className="bullet-tip" d="M4 0C1.6 2.5 1 5 1 8.6h6C7 5 6.4 2.5 4 0Z" />
      <rect className="bullet-case" x="1" y="8.4" width="6" height="11" rx="0.5" />
      <rect className="bullet-rim" x="0.4" y="19.3" width="7.2" height="2.7" rx="0.6" />
      <path className="bullet-shine" d="M2.3 9.5h1v9h-1Z" />
    </svg>
  );
}

/** Bolsa de dinero del add-on. */
export function BagIcon() {
  return (
    <svg className="poker-icon poker-icon-bag" viewBox="0 0 20 22" aria-hidden="true">
      <path d="M7 1h6l-2 4H9Z" />
      <path d="M8 6h4c4.5 2.5 7 7 7 10.5 0 3-2.5 4.5-6 4.5H7c-3.5 0-6-1.5-6-4.5C1 13 3.5 8.5 8 6Z" />
      <text x="10" y="18" textAnchor="middle">
        €
      </text>
    </svg>
  );
}

/** Calavera para eliminar a un jugador de la mesa. */
export function SkullIcon() {
  return (
    <svg className="poker-icon poker-icon-skull" viewBox="0 0 20 22" aria-hidden="true">
      <path d="M10 1C5 1 1.5 4.6 1.5 9.2c0 2.8 1.3 4.9 3.3 6.1V19c0 .8.6 1.4 1.4 1.4h7.6c.8 0 1.4-.6 1.4-1.4v-3.7c2-1.2 3.3-3.3 3.3-6.1C18.5 4.6 15 1 10 1Z" />
      <circle className="skull-hole" cx="6.6" cy="10" r="2.3" />
      <circle className="skull-hole" cx="13.4" cy="10" r="2.3" />
      <path className="skull-hole" d="M10 13.2 8.7 15.6h2.6Z" />
      <path className="skull-teeth" d="M8 17.5v2.9M10 17.5v2.9M12 17.5v2.9" />
    </svg>
  );
}

/** Compras de un jugador con sus iconos; el texto completo queda para lectores de pantalla. */
export function Purchases({ rebuys, addOns }: { rebuys: number; addOns: number }) {
  const label =
    [
      rebuys > 0 && `${rebuys} ${rebuys === 1 ? 'recompra' : 'recompras'}`,
      addOns > 0 && `${addOns} ${addOns === 1 ? 'add-on' : 'add-ons'}`,
    ]
      .filter(Boolean)
      .join(' · ') || 'Sin recompras ni add-ons';
  return (
    <p className="poker-purchases" role="img" aria-label={label} title={label}>
      {rebuys === 0 && addOns === 0 && <span className="poker-note">{label}</span>}
      {rebuys > 0 && (
        <span>
          <BulletIcon />×{rebuys}
        </span>
      )}
      {addOns > 0 && (
        <span>
          <BagIcon />×{addOns}
        </span>
      )}
    </p>
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
          <BulletIcon />
          {rebuys > 1 && <b>{rebuys}</b>}
        </span>
      )}
      {addOns > 0 && (
        <span className="poker-seat-bag">
          <BagIcon />
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
