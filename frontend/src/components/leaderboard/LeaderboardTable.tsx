import type { CSSProperties } from 'react';
import { UserAvatar } from '../Avatar';
import type { LeaderboardRow, SortColumn } from '../../hooks/useLeaderboard';
import { isOwnRow, rankLabel, type LeaderboardColumn } from './leaderboardColumns';

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  columns: LeaderboardColumn[];
  isMatchday: boolean;
  lowestPaidRank: number;
  userId: string | number | null | undefined;
  userName: string | null | undefined;
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  onSort: (column: SortColumn) => void;
  /** Abre lo que se ve de un participante: su porra o la pantalla de jornadas. */
  /** Abre las predicciones de una fila; sin él, las filas no se abren (la Fórmula 1). */
  onOpenRow?: (row: LeaderboardRow) => void;
}

const TOTAL_CELL_STYLE: CSSProperties = {
  color: 'var(--accent-text)',
  fontWeight: 'bold',
  fontSize: '1.1em',
  textAlign: 'center',
};

/** Tabla de la clasificación, ordenable por columna. */
export default function LeaderboardTable({
  rows,
  columns,
  isMatchday,
  lowestPaidRank,
  userId,
  userName,
  sortColumn,
  sortDirection,
  onSort,
  onOpenRow,
}: LeaderboardTableProps) {
  const sortIndicator = (key: SortColumn) =>
    sortColumn !== key ? '' : sortDirection === 'desc' ? ' ▼' : ' ▲';

  const headerStyle = (key: SortColumn): CSSProperties => ({
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 0.2s, background 0.2s',
    background: 'transparent',
    color: 'inherit',
    borderBottom: sortColumn === key ? '3px solid var(--ink)' : undefined,
  });

  const columnClass = (col: LeaderboardColumn) => {
    if (col.kind === 'matchday') return 'lb-matchday-cell';
    if (col.kind === 'detail' && !isMatchday) return 'leaderboard-mobile-detail';
    return '';
  };

  return (
    <div className="ranking-table-scroll">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Participante</th>
            {columns.map((col) => (
              <th
                key={col.key}
                className={columnClass(col)}
                style={headerStyle(col.key)}
                aria-sort={
                  sortColumn === col.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  className="leaderboard-sort-button"
                  onClick={() => onSort(col.key)}
                  title={`Ordenar por ${col.label}`}
                  aria-label={`Ordenar por ${col.label}`}
                >
                  {col.shortLabel || col.label}
                  <span aria-hidden="true">{sortIndicator(col.key)}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody id="leaderboard-body-tab">
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 2}>
                <p role="status" className="py-6 text-muted">
                  Todavía no hay participantes en la clasificación.
                </p>
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const open = r.id != null && onOpenRow ? () => onOpenRow(r) : undefined;
            const isPending = !r.paid;
            const isMe = isOwnRow(r, userId, userName);
            const rowStyle: CSSProperties = {
              background: isMe
                ? 'rgba(11, 95, 116, 0.08)'
                : isPending
                  ? 'rgba(255, 165, 0, 0.05)'
                  : 'transparent',
              boxShadow: isMe ? 'inset 0 0 0 1px var(--accent-color)' : 'none',
            };

            return (
              <tr
                key={r.key}
                style={open ? { ...rowStyle, cursor: 'pointer' } : rowStyle}
                onClick={open}
              >
                <td className="text-[1.2em] text-center">
                  {rankLabel(r.rank, lowestPaidRank, r.points.total)}
                </td>
                <td>
                  <div className="flex justify-start items-center flex-nowrap gap-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <UserAvatar url={r.avatarUrl} userId={r.userId} name={r.name} size={28} />
                      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <span className="text-[1.1em]">
                          <strong>
                            {r.name}
                            {isMe && (
                              <span className="text-accent-text ml-[5px] text-[0.8em] whitespace-nowrap">
                                (Tú)
                              </span>
                            )}
                          </strong>
                        </span>
                        {isPending && (
                          <span
                            className="lb-unpaid-badge"
                            title="Pago pendiente. El administrador debe marcarlo como pagado para mostrar sus puntos."
                          >
                            Sin pagar
                          </span>
                        )}
                        {r.points.eliminated && (
                          <span
                            className="lb-unpaid-badge lb-out-badge"
                            title="Superviviente: eliminado. Sus jornadas superadas ya no suben."
                          >
                            Eliminado
                          </span>
                        )}
                      </div>
                    </div>

                    {open && (
                      <button
                        className="glass-btn bg-[rgba(11,_95,_116,_0.08)] bg-none text-accent-text border border-accent py-[5px] px-[7px] min-w-11 min-h-11 ml-auto shrink-0 whitespace-nowrap text-[0.95rem] leading-[1] inline-flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          open();
                        }}
                        title={isMatchday ? 'Ver partidos de la jornada' : 'Ver porra'}
                      >
                        <span aria-hidden="true" className="poster-title text-[0.75rem]">
                          Ver
                        </span>
                        <span className="sr-only">{isMatchday ? 'Ver jornadas' : 'Ver porra'}</span>
                      </button>
                    )}
                  </div>
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={columnClass(col)}
                    style={col.kind === 'total' ? TOTAL_CELL_STYLE : undefined}
                  >
                    {col.kind === 'total' ? (
                      <span className="lb-total-value">
                        {r.paid ? `${r.points.total ?? 0} pts` : '-'}
                      </span>
                    ) : r.paid ? (
                      `${r.points[col.key] ?? 0}`
                    ) : (
                      '-'
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
