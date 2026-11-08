/**
 * Marcador de un partido de tenis a partir de su `displayClock`, que el servidor rellena con los juegos de
 * cada set (primer jugador-segundo jugador) y, si no se jugó entero, cómo acabó: «6-4 3-6 7-6(5)»,
 * «6-4 2-1 RET» o «WO» (`TennisDataProvider.scoreLine`).
 */

interface TennisSet {
  home: number;
  away: number;
  /** Puntos del tie-break de quien lo perdió («7-6(5)»); null si el set no tuvo tie-break. */
  tiebreak: number | null;
}

type TennisEnding = 'RET' | 'WO' | 'DEF' | 'ABD';

export interface TennisScore {
  sets: TennisSet[];
  ending: TennisEnding | null;
}

const SET = /^(\d{1,2})-(\d{1,2})(?:\((\d{1,3})\))?$/;
const ENDINGS: Record<TennisEnding, string> = {
  RET: 'retirada',
  WO: 'W.O.',
  DEF: 'descalificación',
  ABD: 'suspendido',
};

const isEnding = (token: string): token is TennisEnding => token in ENDINGS;

/** Marcador por sets de un `displayClock` de tenis; null si no lo es (sin datos o de otro deporte). */
export function parseTennisScore(displayClock: string | null | undefined): TennisScore | null {
  const tokens = displayClock?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  const ending = isEnding(last) ? last : null;
  const sets: TennisSet[] = [];
  for (const token of ending ? tokens.slice(0, -1) : tokens) {
    const match = SET.exec(token);
    if (!match) return null;
    sets.push({
      home: Number(match[1]),
      away: Number(match[2]),
      tiebreak: match[3] != null ? Number(match[3]) : null,
    });
  }
  return { sets, ending };
}

/** «retirada», «W.O.»…: cómo acabó un partido que no se jugó entero; null si se jugó entero. */
export const tennisEndingLabel = (score: TennisScore | null): string | null =>
  score?.ending ? ENDINGS[score.ending] : null;

/** «6-4 3-6 7-6(5)» o «6-4 2-1 · retirada» o «W.O.». */
export function tennisScoreText(score: TennisScore): string {
  const sets = score.sets
    .map((set) => `${set.home}-${set.away}${set.tiebreak != null ? `(${set.tiebreak})` : ''}`)
    .join(' ');
  const ending = tennisEndingLabel(score);
  return [sets, ending].filter(Boolean).join(' · ');
}
