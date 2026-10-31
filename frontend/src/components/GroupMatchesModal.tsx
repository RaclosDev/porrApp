import { useRef } from 'react';
import { createPortal } from 'react-dom';
import Flag from './Flag';
import { openStats } from '../utils/navigation';
import type { Match } from '../types/api';
import { useDialogFocus } from '../hooks/useDialogFocus';

export interface SelectedGroup {
  name: string;
  teams: { name: string }[];
}

interface GroupMatchesModalProps {
  selectedGroup: SelectedGroup | null;
  allGames: Match[];
  onClose: () => void;
}

/**
 * Modal flotante que muestra la lista de partidos de un grupo específico.
 */
const GroupMatchesModal = ({ selectedGroup, allGames, onClose }: GroupMatchesModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { active: Boolean(selectedGroup), onEscape: onClose });

  if (!selectedGroup) return null;

  const groupNames = selectedGroup.teams.map((t) => t.name);
  const groupMatches = allGames.filter(
    (g) => groupNames.includes(g.home) && groupNames.includes(g.away),
  );
  groupMatches.sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());

  return createPortal(
    <>
      <div
        onClick={onClose}
        className="modal-backdrop-mobile fixed top-0 left-0 right-0 bottom-0 z-[99998]"
      />
      <div
        className="group-matches-popover"
        role="dialog"
        aria-modal="true"
        aria-label={`Partidos del Grupo ${selectedGroup.name}`}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-[15px]">
          <h4 className="m-0 text-cyan text-center flex-1">
            Partidos del Grupo {selectedGroup.name}
          </h4>
          <button
            type="button"
            className="bg-none bg-transparent border-none text-[#aaa] text-[1.4rem] cursor-pointer absolute right-1 top-[3px] z-[2] w-11 h-11 flex items-center justify-center"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="last-matches-grid grid-cols-[1fr] gap-2">
          {groupMatches.length === 0 ? (
            <p className="text-center text-muted">No hay partidos registrados.</p>
          ) : (
            groupMatches.map((m) => {
              const d = new Date(m.date ?? 0);
              const dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
              const hasStarted = new Date() >= d;
              const hasFinished = m.finished === true;

              return (
                <div
                  className="cursor-pointer grid grid-cols-[70px_minmax(0,_1fr)_45px_minmax(0,_1fr)] gap-1.5 items-center bg-[rgba(255,255,255,0.05)] bg-none border border-[rgba(255,255,255,0.05)] py-2 px-2.5 min-h-11 rounded-[6px] text-[0.85rem] whitespace-nowrap"
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openStats()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openStats();
                    }
                  }}
                  aria-label={`Ver estadísticas de ${m.home} contra ${m.away}`}
                >
                  <div className="text-muted text-[0.75rem]">
                    {hasFinished ? 'Final' : 'Próx'} {dateFormatted}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-right">
                    <span className="overflow-hidden text-ellipsis">{m.home}</span>
                    <Flag team={m.home} logo={m.homeLogo || m.homeTeamLogo} />
                  </div>
                  <div
                    className={`py-0.5 px-0 font-bold text-center rounded-[4px] ${hasStarted ? 'text-white' : 'text-muted'} ${hasStarted ? 'bg-[rgba(0,0,0,0.3)] bg-none' : 'bg-transparent bg-none'}`}
                  >
                    {hasStarted ? `${m.homeScore} - ${m.awayScore}` : 'VS'}
                  </div>
                  <div className="flex items-center justify-start gap-1.5">
                    <Flag team={m.away} logo={m.awayLogo || m.awayTeamLogo} />
                    <span className="overflow-hidden text-ellipsis">{m.away}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
  );
};

export default GroupMatchesModal;
