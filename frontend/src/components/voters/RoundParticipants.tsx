import { useState } from 'react';
import { UserAvatar } from '../Avatar';
import PeopleListDialog from '../PeopleListDialog';
import type { MatchVoter } from '../../types/api';

/** Fotos que caben en una cabecera estrecha; el resto se resume en «+N». */
const COMPACT_PARTICIPANTS = 2;
/** Fotos que caben cuando la cabecera tiene sitio. */
const WIDE_PARTICIPANTS = 4;

/** «Ana», «Ana y Bea», «Ana, Bea y Carla». */
function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function participantsSummary(count: number) {
  return count === 1
    ? '1 miembro ya ha hecho su predicción'
    : `${count} miembros ya han hecho su predicción`;
}

/**
 * Las caras de quienes ya han hecho su predicción en la jornada, solapadas y resumidas en «+N». Al
 * pulsarlas se abre la lista con todos los nombres; al pasar el ratón se ve cada nombre. Sin nadie
 * no pinta nada.
 */
export default function RoundParticipants({
  participants,
  roundLabel = '',
}: {
  participants: MatchVoter[];
  roundLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = participants.length;
  if (count === 0) return null;
  const names = participants.map((participant) => participant.name);

  return (
    <>
      <button
        type="button"
        className="round-participants"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${participantsSummary(count)}: ${joinNames(names)}. Ver la lista`}
        title={names.join(', ')}
      >
        <span className="round-participants-stack" aria-hidden="true">
          {participants.slice(0, WIDE_PARTICIPANTS).map((participant, index) => (
            <span
              key={participant.userId}
              className={`round-participants-avatar${index >= COMPACT_PARTICIPANTS ? ' is-wide-only' : ''}`}
              title={participant.name}
            >
              <UserAvatar
                url={participant.avatarUrl}
                userId={participant.userId}
                name={participant.name}
                size={22}
              />
            </span>
          ))}
          {count > COMPACT_PARTICIPANTS && (
            <span className="round-participants-more is-compact-only">
              +{count - COMPACT_PARTICIPANTS}
            </span>
          )}
          {count > WIDE_PARTICIPANTS && (
            <span className="round-participants-more is-wide-only">
              +{count - WIDE_PARTICIPANTS}
            </span>
          )}
        </span>
      </button>
      {open && (
        <PeopleListDialog
          title="Ya han hecho su predicción"
          subtitle={roundLabel}
          intro={`${participantsSummary(count)}. Sus predicciones se verán cuando empiece cada partido.`}
          people={participants}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
