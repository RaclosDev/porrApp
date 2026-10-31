import { STAGE_LABEL, type StageId, type TeamStageRow } from '../../utils/bracketStats';
import { RealMark } from './PickRow';

const SUB_STAGES: StageId[] = ['first', 'second', 'third'];

interface TeamFunnelProps {
  rows: TeamStageRow[];
  total: number;
  selected: StageId;
  onSelect: (stage: StageId) => void;
}

/**
 * Cuántos cuadros llevan al equipo a cada ronda. Cada fila elige la ronda cuya lista de
 * participantes se muestra debajo.
 */
export default function TeamFunnel({ rows, total, selected, onSelect }: TeamFunnelProps) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {rows.map((row) => {
        const isSub = SUB_STAGES.includes(row.stage);
        const active = row.stage === selected;
        return (
          <li key={row.stage} className={isSub ? 'pl-4' : ''}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(row.stage)}
              className={`block min-h-11 w-full rounded-[10px] border px-2.5 py-2 text-left transition-colors ${active ? 'border-cyan bg-[rgba(11,95,116,0.1)]' : 'border-transparent hover:bg-[rgba(17,24,39,0.05)]'}`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`min-w-0 flex-1 truncate ${isSub ? 'text-[0.9rem] text-muted' : 'font-semibold text-main'}`}
                >
                  {STAGE_LABEL[row.stage]}
                </span>
                <RealMark status={row.status} yes="Se ha cumplido" no="No se ha cumplido" />
                <span className="shrink-0 font-bold tabular-nums text-main">{row.percent} %</span>
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(17,24,39,0.08)]">
                  <span
                    className={`block h-full rounded-full ${isSub ? 'bg-accent-text' : 'bg-cyan'}`}
                    style={{ width: `${row.percent}%` }}
                  />
                </span>
                <span className="shrink-0 text-[0.78rem] text-muted tabular-nums">
                  {row.count} de {total}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
