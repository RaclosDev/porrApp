import type { RealStatus } from '../../utils/bracketStats';
import { RealMark } from './PickRow';

export interface FunnelRow<T extends string> {
  id: T;
  label: string;
  /** Fila secundaria (puesto de grupo, puesto exacto del podio…): va sangrada. */
  sub?: boolean;
  count: number;
  percent: number;
  /** Si ya se ha cumplido de verdad; sin marca mientras no se sabe. */
  status?: RealStatus;
  /** Texto pequeño junto al recuento, p. ej. «3 aciertos». */
  note?: string;
  /** Total propio de la fila, si no todas se cuentan sobre el mismo. */
  total?: number;
}

interface PickFunnelProps<T extends string> {
  rows: FunnelRow<T>[];
  total: number;
  selected: T;
  onSelect: (id: T) => void;
}

/**
 * Cuántas predicciones ponen al equipo (o al piloto) en cada ronda o puesto. Cada fila elige la
 * lista de participantes que se muestra al lado.
 */
export default function PickFunnel<T extends string>({
  rows,
  total,
  selected,
  onSelect,
}: PickFunnelProps<T>) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {rows.map((row) => {
        const active = row.id === selected;
        return (
          <li key={row.id} className={row.sub ? 'pl-4' : ''}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(row.id)}
              className={`block min-h-11 w-full rounded-[10px] border px-2.5 py-2 text-left transition-colors ${active ? 'border-cyan bg-[rgba(11,95,116,0.1)]' : 'border-transparent hover:bg-[rgba(17,24,39,0.05)]'}`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`min-w-0 flex-1 truncate ${row.sub ? 'text-[0.9rem] text-muted' : 'font-semibold text-main'}`}
                >
                  {row.label}
                </span>
                <RealMark
                  status={row.status ?? 'pending'}
                  yes="Se ha cumplido"
                  no="No se ha cumplido"
                />
                <span className="shrink-0 font-bold tabular-nums text-main">{row.percent} %</span>
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(17,24,39,0.08)]">
                  <span
                    className={`block h-full rounded-full ${row.sub ? 'bg-accent-text' : 'bg-cyan'}`}
                    style={{ width: `${row.percent}%` }}
                  />
                </span>
                <span className="shrink-0 text-[0.78rem] text-muted tabular-nums">
                  {row.count} de {row.total ?? total}
                  {row.note ? ` · ${row.note}` : ''}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
