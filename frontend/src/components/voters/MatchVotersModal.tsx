import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import { UserAvatar } from '../Avatar';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { MatchVoters } from '../../types/api';

interface MatchVotersModalProps {
  voters: MatchVoters | null;
  homeTeam: string;
  awayTeam: string;
  onClose: () => void;
  /** Cruce de cuadro: no hay empate que mostrar. */
  twoWay?: boolean;
}

/** Quién ha votado cada signo de un partido cerrado, agrupado por opción. */
export default function MatchVotersModal({
  voters,
  homeTeam,
  awayTeam,
  onClose,
  twoWay = false,
}: MatchVotersModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = voters != null;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useDialogFocus(dialogRef, { active: open, onEscape: onClose });

  if (!voters) return null;

  const groups = [
    { key: 'home', sign: '1', title: `Gana ${homeTeam}`, list: voters.home },
    { key: 'draw', sign: 'X', title: 'Empate', list: voters.draw },
    { key: 'away', sign: '2', title: `Gana ${awayTeam}`, list: voters.away },
  ].filter(({ key }) => !twoWay || key !== 'draw');

  return createPortal(
    <div
      className="friends-predictions-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="friends-predictions-panel paper-panel landing-tape paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-voters-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="friends-predictions-head">
          <h2 id="match-voters-title" className="friends-predictions-title">
            {homeTeam} - {awayTeam}
          </h2>
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
          {groups.map(({ key, sign, title, list }) => (
            <section key={key} className="match-voters-group" aria-label={`${sign} · ${title}`}>
              <h3 className="match-voters-heading">
                <span className="match-voters-sign">{sign}</span>
                <span className="min-w-0 truncate">{title}</span>
                <span className="match-voters-count">{list.length}</span>
              </h3>
              {list.length === 0 ? (
                <p className="text-muted text-[0.85rem] m-0">Nadie</p>
              ) : (
                <ul className="match-voters-list">
                  {list.map((voter) => (
                    <li key={voter.userId}>
                      <UserAvatar
                        url={voter.avatarUrl}
                        userId={voter.userId}
                        name={voter.name}
                        size={28}
                      />
                      <span className="min-w-0 truncate">{voter.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
