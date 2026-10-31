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
    <div className="paper-dialog-overlay" onClick={onClose}>
      <div
        className="paper-panel landing-tape paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Partidos del Grupo ${selectedGroup.name}`}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="paper-dialog-heading">
          <h4 className="m-0 poster-title text-xl">Partidos del Grupo {selectedGroup.name}</h4>
          <button
            type="button"
            className="paper-dialog-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="paper-dialog-body last-matches-grid grid-cols-[1fr] gap-2">
          {groupMatches.length === 0 ? (
            <p className="text-center text-muted">No hay partidos registrados.</p>
          ) : (
            groupMatches.map((m) => {
              const d = m.date ? new Date(m.date) : null;
              const validDate = d && !Number.isNaN(d.getTime());
              const dateFormatted = validDate
                ? d.toLocaleString('es-ES', {
                    day: 'numeric',
                    month: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Fecha por confirmar';
              const status = m.status?.toUpperCase() ?? '';
              const live = ['LIVE', 'PAUSED', 'IN_PLAY', 'IN_PROGRESS'].includes(status);
              const stateLabel = m.finished
                ? 'Final'
                : live
                  ? 'En directo'
                  : ['POSTPONED', 'SUSPENDED'].includes(status)
                    ? 'Aplazado'
                    : ['CANCELLED', 'CANCELED'].includes(status)
                      ? 'Cancelado'
                      : validDate && d > new Date()
                        ? 'Próx'
                        : 'Pendiente';
              const homeScore = m.homeScore ?? m.home_score;
              const awayScore = m.awayScore ?? m.away_score;
              const hasScore = homeScore != null && awayScore != null && (m.finished || live);

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
                  aria-label={`${m.home} contra ${m.away}. Abrir el portal de fútbol de Sofascore`}
                >
                  <div className="text-muted text-[0.75rem] whitespace-normal">
                    {stateLabel} {dateFormatted}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-right">
                    <span className="overflow-hidden text-ellipsis">{m.home}</span>
                    <Flag team={m.home} logo={m.homeLogo || m.homeTeamLogo} />
                  </div>
                  <div
                    className={`py-0.5 px-0 font-bold text-center rounded-[4px] ${hasScore ? 'text-main' : 'text-muted'} ${hasScore ? 'bg-[rgba(0,0,0,0.3)] bg-none' : 'bg-transparent bg-none'}`}
                  >
                    {hasScore ? `${homeScore} - ${awayScore}` : 'VS'}
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
    </div>,
    document.body,
  );
};

export default GroupMatchesModal;
