import type { SortColumn } from '../../hooks/useLeaderboard';

export interface LeaderboardColumn {
  key: SortColumn;
  label: string;
  shortLabel?: string;
  kind: 'total' | 'matchday' | 'detail';
}

/** Medalla para el podio (solo con puntos), tortuga para el último que ha pagado y número para el resto. */
export function rankLabel(
  rank: number | '-' | undefined,
  lowestPaidRank: number,
  points: number,
): string | number {
  if (points <= 0 && typeof rank === 'number' && rank <= 3) return rank;
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank === lowestPaidRank && lowestPaidRank > 3) return '🐢';
  return rank ?? '-';
}

/** Rondas de los playoffs de la NFL, abreviadas. */
const NFL_PLAYOFF_SHORT: Record<string, string> = {
  'Ronda de comodines': 'WC',
  'Ronda divisional': 'Div.',
  'Final de conferencia': 'Conf.',
  'Super Bowl': 'SB',
};

/** «Jornada 12» -> «J12»; «Semana 9» (NFL) -> «S9»; «Fecha 2026-03-14» -> «14/03». */
export const compactMatchdayLabel = (label: string | null) => {
  if (!label) return '';
  const jornada = /^jornada\s+(\d+)$/i.exec(label);
  if (jornada) return `J${jornada[1]}`;
  const semana = /^semana\s+(\d+)$/i.exec(label);
  if (semana) return `S${semana[1]}`;
  if (NFL_PLAYOFF_SHORT[label]) return NFL_PLAYOFF_SHORT[label];
  const fecha = /^fecha\s+(\d{4})-(\d{2})-(\d{2})$/i.exec(label);
  if (fecha) return `${fecha[3]}/${fecha[2]}`;
  return label;
};

/** La fila es del usuario: por id cuando las dos partes lo tienen y, si no, por nombre. */
export function isOwnRow(
  row: { userId?: number | string | null; name?: string },
  userId: number | string | null | undefined,
  userName: string | null | undefined,
): boolean {
  if (row.userId != null && userId != null) return String(row.userId) === String(userId);
  return Boolean(userName) && row.name === userName;
}

interface ColumnOptions {
  isMatchday: boolean;
  ownBracket: boolean;
  pichichi: boolean;
  /** Algún pronóstico tiene puntos de la fase de grupos (solo en los cuadros propios). */
  ownBracketHasGroupPoints: boolean;
  selectedMatchday: string | null;
}

/** Columnas de la tabla según el formato de la liga. */
export function leaderboardColumns({
  isMatchday,
  ownBracket,
  pichichi,
  ownBracketHasGroupPoints,
  selectedMatchday,
}: ColumnOptions): LeaderboardColumn[] {
  const scorerColumn: LeaderboardColumn[] = pichichi
    ? [{ key: 'scorer', label: 'Pichichi', kind: 'detail' }]
    : [];
  if (isMatchday) {
    return [
      { key: 'total', label: 'Total', kind: 'total' },
      selectedMatchday
        ? {
            key: 'matchday',
            label: selectedMatchday,
            shortLabel: compactMatchdayLabel(selectedMatchday),
            kind: 'matchday',
          }
        : { key: 'matchPoints', label: 'Puntos de jornada', kind: 'detail' },
      ...scorerColumn,
    ];
  }
  if (ownBracket) {
    return [
      { key: 'total', label: 'Total', kind: 'total' },
      // Sin fase de grupos (o sin nada que puntuar en ella) la columna sería siempre 0.
      ...(ownBracketHasGroupPoints
        ? [{ key: 'r1', label: 'Grupos', kind: 'detail' } as LeaderboardColumn]
        : []),
      { key: 'r32', label: 'Cuadro', kind: 'detail' },
    ];
  }
  return [
    { key: 'total', label: 'Total', kind: 'total' },
    { key: 'matchPoints', label: 'Jornadas', kind: 'detail' },
    { key: 'r1', label: 'F.Grupos', kind: 'detail' },
    { key: 'r32', label: 'Dieciseisavos', kind: 'detail' },
    { key: 'r16', label: 'Octavos', kind: 'detail' },
    { key: 'qf', label: 'Cuartos', kind: 'detail' },
    { key: 'sf', label: 'Semis', kind: 'detail' },
    { key: 'finals', label: 'Finales', kind: 'detail' },
    ...scorerColumn,
  ];
}
