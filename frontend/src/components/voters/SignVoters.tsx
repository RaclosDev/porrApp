import { UserAvatar } from '../Avatar';
import type { MatchVoter, MatchVoters } from '../../types/api';

/** Avatares que caben bajo cada signo antes de resumir el resto en «+N». */
export const VISIBLE_VOTERS = 3;

const SIGNS = [
  { key: 'home', label: '1' },
  { key: 'draw', label: 'X' },
  { key: 'away', label: '2' },
] as const;

/** En los cuadros no hay empate: solo quién pasa, el local o el visitante. */
const WINNER_SIDES = SIGNS.filter(({ key }) => key !== 'draw');

interface SignVotersProps {
  voters: MatchVoters;
  matchName: string;
  onOpen: () => void;
  className?: string;
  /** Cruce de cuadro: dos columnas, una bajo cada equipo, sin empate. */
  twoWay?: boolean;
}

/** Bajo cada signo, las fotos de quienes lo han votado; al pulsar se abre la lista completa. */
export default function SignVoters({
  voters,
  matchName,
  onOpen,
  className = '',
  twoWay = false,
}: SignVotersProps) {
  return (
    <div className={`sign-voters${twoWay ? ' is-two-way' : ''} ${className}`}>
      {(twoWay ? WINNER_SIDES : SIGNS).map(({ key, label }) => {
        const list: MatchVoter[] = voters[key];
        if (list.length === 0) return <span key={key} className="sign-voters-cell" />;
        const extra = list.length - VISIBLE_VOTERS;
        return (
          <button
            key={key}
            type="button"
            className="sign-voters-cell"
            onClick={onOpen}
            aria-label={`Ver quién ha votado ${label} en ${matchName} (${list.length})`}
          >
            {list.slice(0, VISIBLE_VOTERS).map((voter) => (
              <span key={voter.userId} className="sign-voters-avatar" title={voter.name}>
                <UserAvatar
                  url={voter.avatarUrl}
                  userId={voter.userId}
                  name={voter.name}
                  size={22}
                />
              </span>
            ))}
            {extra > 0 && <span className="sign-voters-more">+{extra}</span>}
          </button>
        );
      })}
    </div>
  );
}
