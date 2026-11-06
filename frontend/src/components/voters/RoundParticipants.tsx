import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { UserAvatar } from '../Avatar';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { MatchVoter } from '../../types/api';

/** Fotos que caben en una cabecera estrecha; el resto se resume en «+N». */
export const COMPACT_PARTICIPANTS = 2;
/** Fotos que caben cuando la cabecera tiene sitio. */
export const WIDE_PARTICIPANTS = 4;

/** «Ana», «Ana y Bea», «Ana, Bea y Carla». */
function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function participantsSummary(count: number) {
  return count === 1
    ? '1 miembro ya ha hecho su predicción'
    : `${count} miembros ya han hecho su predicción`;
}

function ParticipantsDialog({
  participants,
  roundLabel,
  onClose,
}: {
  participants: MatchVoter[];
  roundLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogFocus(dialogRef, { onEscape: onClose });

  return createPortal(
    <div
      className="friends-predictions-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="friends-predictions-panel paper-panel landing-tape paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-participants-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="friends-predictions-head">
          <div className="min-w-0">
            <h2 id="round-participants-title" className="friends-predictions-title">
              Ya han hecho su predicción
            </h2>
            {roundLabel && <p className="text-muted text-[0.85rem] m-0">{roundLabel}</p>}
          </div>
          <button
            type="button"
            className="friends-predictions-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="friends-predictions-list">
          <p className="text-muted text-[0.85rem] mt-0 mb-2.5">
            {participantsSummary(participants.length)}. Sus predicciones se verán cuando empiece
            cada partido.
          </p>
          <ul className="match-voters-list">
            {participants.map((participant) => (
              <li key={participant.userId}>
                <UserAvatar
                  url={participant.avatarUrl}
                  userId={participant.userId}
                  name={participant.name}
                  size={28}
                />
                <span className="min-w-0 truncate">{participant.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
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
        <ParticipantsDialog
          participants={participants}
          roundLabel={roundLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
