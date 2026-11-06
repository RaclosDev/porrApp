import { createPortal } from 'react-dom';
import DialogBackdrop from './DialogBackdrop';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { UserAvatar } from './Avatar';
import { useDialogFocus } from '../hooks/useDialogFocus';

export interface PersonItem {
  userId: number;
  name: string;
  avatarUrl: string | null;
  /** Etiqueta corta junto al nombre, como «Admin». */
  badge?: string;
}

/**
 * Diálogo de papel con una lista de personas (foto y nombre). Se cierra con Escape, con la X o al
 * pulsar fuera, y devuelve el foco a quien lo abrió.
 */
export default function PeopleListDialog({
  title,
  subtitle,
  intro,
  people,
  status,
  onClose,
}: {
  title: string;
  subtitle?: string;
  /** Texto bajo la cabecera, antes de la lista. */
  intro?: ReactNode;
  people: PersonItem[];
  /** Mensaje en lugar de la lista mientras carga o si falla. */
  status?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogFocus(dialogRef, { onEscape: onClose });

  return createPortal(
    <DialogBackdrop className="friends-predictions-overlay" onDismiss={onClose}>
      <div
        className="friends-predictions-panel paper-panel landing-tape paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="friends-predictions-head">
          <div className="min-w-0">
            <h2 id={titleId} className="friends-predictions-title">
              {title}
            </h2>
            {subtitle && <p className="text-muted text-[0.85rem] m-0">{subtitle}</p>}
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
          {intro && <p className="text-muted text-[0.85rem] mt-0 mb-2.5">{intro}</p>}
          {status ? (
            <p className="text-muted text-[0.9rem] m-0" role="status">
              {status}
            </p>
          ) : (
            <ul className="match-voters-list">
              {people.map((person) => (
                <li key={person.userId}>
                  <UserAvatar
                    url={person.avatarUrl}
                    userId={person.userId}
                    name={person.name}
                    size={28}
                  />
                  <span className="min-w-0 truncate">{person.name}</span>
                  {person.badge && <span className="people-list-badge">{person.badge}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
