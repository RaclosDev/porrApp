import { useLayoutEffect, useRef, useState } from 'react';
import { UserAvatar } from '../Avatar';
import PeopleListDialog from '../PeopleListDialog';
import type { MatchVoter } from '../../types/api';

/** Tamaño de cada cara, su borde y cuánto se solapa con la anterior, en píxeles. */
const AVATAR_SIZE = 26;
const AVATAR_BORDER = 2;
const AVATAR_OVERLAP = 8;
/** Sitio que se reserva para «+N» cuando no caben todas. */
const MORE_WIDTH = 34;
/** Caras antes de medir la cabecera (o sin ResizeObserver). */
const DEFAULT_VISIBLE = 4;

/**
 * Cuántas caras caben en `width` píxeles; si no caben todas, deja sitio para «+N» y muestra al
 * menos una.
 */
export function avatarsThatFit(width: number, count: number) {
  const face = AVATAR_SIZE + AVATAR_BORDER * 2;
  const step = face - AVATAR_OVERLAP;
  const fitting = (room: number) => (room < face ? 0 : 1 + Math.floor((room - face) / step));
  if (fitting(width) >= count) return count;
  return Math.max(1, fitting(width - MORE_WIDTH));
}

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
  const [width, setWidth] = useState<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const count = participants.length;
  const hasParticipants = count > 0;

  // La fila ocupa el hueco libre de la cabecera: se mide para pintar tantas caras como quepan.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => setWidth(button.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(button);
    return () => observer.disconnect();
  }, [hasParticipants]);

  if (count === 0) return null;
  const names = participants.map((participant) => participant.name);
  const visible = width ? avatarsThatFit(width, count) : Math.min(count, DEFAULT_VISIBLE);
  const hidden = count - visible;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="round-participants"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${participantsSummary(count)}: ${joinNames(names)}. Ver la lista`}
        title={names.join(', ')}
      >
        <span className="round-participants-stack" aria-hidden="true">
          {participants.slice(0, visible).map((participant) => (
            <span
              key={participant.userId}
              className="round-participants-avatar"
              title={participant.name}
            >
              <UserAvatar
                url={participant.avatarUrl}
                userId={participant.userId}
                name={participant.name}
                size={AVATAR_SIZE}
              />
            </span>
          ))}
          {hidden > 0 && <span className="round-participants-more">+{hidden}</span>}
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
