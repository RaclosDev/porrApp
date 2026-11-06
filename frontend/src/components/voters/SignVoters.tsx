import { UserAvatar } from '../Avatar';
import type { MatchVoter, MatchVoters } from '../../types/api';

/** Avatares que caben bajo cada signo antes de resumir el resto en «+N». */
const VISIBLE_VOTERS = 3;

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

interface VoterStackProps {
  list: MatchVoter[];
  /** Signo o equipo votado, para el nombre accesible. */
  label: string;
  matchName: string;
  onOpen: () => void;
  className?: string;
}

/**
 * Las fotos de quienes han votado una opción, resumidas en «+N». Sin votos deja el hueco, para que
 * las opciones de un partido queden a la misma altura.
 */
export function VoterStack({ list, label, matchName, onOpen, className = '' }: VoterStackProps) {
  if (list.length === 0) return <span className={`sign-voters-cell ${className}`} />;
  const extra = list.length - VISIBLE_VOTERS;
  return (
    <button
      type="button"
      className={`sign-voters-cell ${className}`}
      onClick={onOpen}
      aria-label={`Ver quién ha votado ${label} en ${matchName} (${list.length})`}
    >
      {list.slice(0, VISIBLE_VOTERS).map((voter) => (
        <span key={voter.userId} className="sign-voters-avatar" title={voter.name}>
          <UserAvatar url={voter.avatarUrl} userId={voter.userId} name={voter.name} size={22} />
        </span>
      ))}
      {extra > 0 && <span className="sign-voters-more">+{extra}</span>}
    </button>
  );
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
      {(twoWay ? WINNER_SIDES : SIGNS).map(({ key, label }) => (
        <VoterStack
          key={key}
          list={voters[key]}
          label={label}
          matchName={matchName}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
