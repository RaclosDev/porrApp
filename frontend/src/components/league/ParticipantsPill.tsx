import { Users } from 'lucide-react';

/**
 * Píldora de la cabecera de una liga con cuántos juegan; al pulsarla se abre la lista. La comparten
 * las porras y el póker.
 */
export default function ParticipantsPill({
  count,
  noun,
  onOpen,
}: {
  count: number;
  /** Singular y plural de lo que se cuenta: participantes, jugadores… */
  noun: [string, string];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="home-hero-pill-btn"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${count} ${count === 1 ? noun[0] : noun[1]}: ver la lista`}
    >
      <span className="home-hero-pill muted is-count">
        {count}
        <Users size={13} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </button>
  );
}
