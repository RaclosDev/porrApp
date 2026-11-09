import type { ReactNode } from 'react';
import Flag from '../Flag';

interface GroupStandingsRow {
  name: string;
  logo?: string | null;
  diff: number;
  gls: number;
  /** Juego limpio; sin él no se muestra la columna. */
  fp?: number;
  pts: number;
  /** Sello de clasificado o eliminado. */
  status?: ReactNode;
}

interface GroupStandingsCardProps {
  groupName: string;
  rows: GroupStandingsRow[];
  selected: boolean;
  /** Abre o cierra los partidos del grupo. */
  onToggle: () => void;
}

/** Tarjeta de clasificación de un grupo; al pulsarla se abren sus partidos. */
export default function GroupStandingsCard({
  groupName,
  rows,
  selected,
  onToggle,
}: GroupStandingsCardProps) {
  const showFairPlay = rows.some((row) => row.fp != null);

  return (
    <div
      className={`group-card paper-panel album-sheet relative cursor-pointer ${selected ? 'z-[100] border border-accent [outline:2px_solid_var(--accent-cyan)]' : 'z-[1]'}`}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles del Grupo ${groupName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      id={`group-card-${groupName}`}
      onClick={onToggle}
    >
      <div className="flex justify-between items-center mb-2.5">
        <h3 className="album-sheet-title mb-0 text-left">Grupo {groupName}</h3>
        <div className="flex gap-2 text-[0.75em] font-bold text-muted pr-1.5">
          <span className="w-5 text-center">DG</span>
          <span className="w-4 text-center">GF</span>
          {showFairPlay && <span className="w-4.5 text-center">FP</span>}
          <span className="w-6 text-center">PTS</span>
        </div>
      </div>

      {rows.map((team, idx) => (
        <div
          className={`flex items-center py-1.5 px-2 mb-1 rounded-[6px] ${idx < 2 ? 'bg-[rgba(17,_24,_39,_0.04)] bg-none' : 'bg-transparent bg-none'}`}
          key={team.name}
        >
          <span className="w-4.5 font-bold text-muted text-[0.85em] shrink-0">{idx + 1}</span>
          <span className="inline-flex items-center mr-[5px] shrink-0">
            <Flag team={team.name} logo={team.logo} />
          </span>
          <span
            className={`grow whitespace-nowrap overflow-hidden text-ellipsis mr-2 ${idx < 2 ? 'font-bold' : 'font-normal'}`}
          >
            {team.name}
          </span>
          {team.status}
          <div className="flex gap-2 text-[0.85em] text-muted">
            <span
              className="w-5 text-center"
              style={{
                color: team.diff > 0 ? 'var(--hit)' : team.diff < 0 ? 'var(--miss)' : 'inherit',
              }}
            >
              {team.diff > 0 ? `+${team.diff}` : team.diff}
            </span>
            <span className="w-4 text-center">{team.gls}</span>
            {showFairPlay && <span className="w-4.5 text-center">{team.fp}</span>}
            <span className="w-6 text-center font-bold text-main">{team.pts}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
