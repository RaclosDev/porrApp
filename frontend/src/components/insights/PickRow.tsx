import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import type { RealStatus } from '../../utils/bracketStats';

/** Marca de lo que ya ha pasado de verdad: acertado, fallado o nada si aún no se sabe. */
export function RealMark({ status, yes, no }: { status: RealStatus; yes: string; no: string }) {
  if (status === 'pending') return null;
  const ok = status === 'yes';
  const Icon = ok ? Check : X;
  return (
    <span
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-[rgba(74,222,128,0.16)] text-[var(--hit)]' : 'bg-[rgba(248,113,113,0.14)] text-[var(--miss)]'}`}
      title={ok ? yes : no}
    >
      <Icon size={13} strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">{ok ? yes : no}</span>
    </span>
  );
}

interface PickRowProps {
  /** Bandera, escudo o icono delante del nombre. */
  icon?: ReactNode;
  label: ReactNode;
  count: number;
  total: number;
  percent: number;
  /** Texto pequeño junto al recuento, p. ej. "Cayó en semis". */
  note?: string;
  status?: RealStatus;
  /** Textos de la marca real para lectores de pantalla. */
  statusText?: { yes: string; no: string };
  /** Si se pasa, la fila abre esta ruta (el buscador con el equipo y la ronda). */
  to?: string;
  /** Resalta la fila (el acierto real). */
  highlight?: boolean;
}

/** Fila de "más elegidos": nombre, porcentaje, barra y recuento. */
export default function PickRow({
  icon,
  label,
  count,
  total,
  percent,
  note,
  status = 'pending',
  statusText = { yes: 'Acertado', no: 'Fallado' },
  to,
  highlight = false,
}: PickRowProps) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1 truncate font-semibold text-main">{label}</span>
        <RealMark status={status} yes={statusText.yes} no={statusText.no} />
        <span className="shrink-0 font-bold tabular-nums text-main">{percent} %</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(100,116,139,0.15)]">
          <div
            className={`h-full rounded-full ${highlight ? 'bg-[var(--hit)]' : 'bg-cyan'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-right text-[0.78rem] text-muted tabular-nums">
          {count} de {total}
          {note ? ` · ${note}` : ''}
        </span>
      </div>
    </>
  );

  const frame = `block min-h-11 rounded-[10px] px-2.5 py-2 ${highlight ? 'bg-[rgba(74,222,128,0.07)] ring-1 ring-[rgba(74,222,128,0.35)]' : ''}`;
  return (
    <li>
      {to ? (
        <Link
          to={to}
          className={`${frame} text-inherit no-underline transition-colors hover:bg-[rgba(17,24,39,0.05)]`}
        >
          {body}
        </Link>
      ) : (
        <div className={frame}>{body}</div>
      )}
    </li>
  );
}
