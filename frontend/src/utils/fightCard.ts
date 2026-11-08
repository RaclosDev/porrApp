/** Cartelera de una velada de la UFC en la pestaña Tabla: bloques, reparto de la liga y balance. */
import type { FightInfo, FightMethod, MatchStats, MatchdayFixture } from '../types/api';
import { FIGHT_METHOD_LABELS } from './fights';

/** Id de la UFC en ESPN. */
const UFC_EXTERNAL_ID = 'mma.ufc';

export const isUfcCompetition = (externalId: string | null | undefined) =>
  externalId?.trim().toLowerCase() === UFC_EXTERNAL_ID;

const SEGMENT_ORDER: Record<NonNullable<FightInfo['segment']>, number> = {
  MAIN: 0,
  PRELIMS: 1,
  EARLY_PRELIMS: 2,
};

export interface CardSegment {
  segment: NonNullable<FightInfo['segment']>;
  fights: MatchdayFixture[];
}

/**
 * Peleas de una velada por bloques, como se anuncian: primero la cartelera estelar (con la pelea
 * estelar arriba), luego los preliminares y al final los tempranos. Sin datos de pelea no salen.
 */
export function groupCard(fixtures: MatchdayFixture[]): CardSegment[] {
  const segments = new Map<CardSegment['segment'], MatchdayFixture[]>();
  for (const fixture of fixtures) {
    if (!fixture.fight) continue;
    const segment = fixture.fight.segment ?? 'PRELIMS';
    segments.set(segment, [...(segments.get(segment) ?? []), fixture]);
  }
  return [...segments.entries()]
    .sort(([a], [b]) => SEGMENT_ORDER[a] - SEGMENT_ORDER[b])
    .map(([segment, fights]) => ({
      segment,
      fights: [...fights].sort(
        (a, b) =>
          (a.fight!.order ?? Number.MAX_SAFE_INTEGER) - (b.fight!.order ?? Number.MAX_SAFE_INTEGER),
      ),
    }));
}

/** «27-1-0» → victorias, derrotas y empates; null si el récord no tiene esa forma. */
export function parseRecord(record: string | null | undefined) {
  const match = /^(\d+)-(\d+)-(\d+)/.exec(record?.trim() ?? '');
  if (!match) return null;
  return { wins: Number(match[1]), losses: Number(match[2]), draws: Number(match[3]) };
}

/** Récord para leerlo en voz alta: «27 victorias, 1 derrota y 0 empates». */
export function recordLabel(record: string | null | undefined): string {
  const parsed = parseRecord(record);
  if (!parsed) return record ?? '';
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `${plural(parsed.wins, 'victoria', 'victorias')}, ${plural(parsed.losses, 'derrota', 'derrotas')} y ${plural(parsed.draws, 'empate', 'empates')}`;
}

export interface LeagueSplit {
  /** Predicciones de la liga con ganador. */
  total: number;
  red: number;
  blue: number;
  /** Porcentajes enteros que suman 100 (o 0 y 0 sin predicciones). */
  redPercent: number;
  bluePercent: number;
  /** Método más elegido y su porcentaje sobre quienes eligieron método; null si nadie lo eligió. */
  topMethod: { label: string; percent: number } | null;
}

/** Cuántos de la liga eligieron a cada luchador y qué método fue el favorito. */
export function leagueSplit(stats: MatchStats | undefined): LeagueSplit | null {
  if (!stats) return null;
  const red = stats.homeWins;
  const blue = stats.awayWins;
  const total = red + blue;
  const redPercent = total ? Math.round((red / total) * 100) : 0;
  const methods = stats.methods ?? [];
  const methodTotal = methods.reduce((sum, m) => sum + m.count, 0);
  const top = methods[0];
  const label = top && FIGHT_METHOD_LABELS[top.method as FightMethod];
  return {
    total,
    red,
    blue,
    redPercent,
    bluePercent: total ? 100 - redPercent : 0,
    topMethod:
      top && label ? { label, percent: Math.round((top.count / methodTotal) * 100) } : null,
  };
}

export interface CardSummary {
  fights: number;
  finished: number;
  /** Peleas terminadas en las que el usuario acertó el ganador. */
  hits: number;
  /** Peleas terminadas en las que el usuario hizo su predicción. */
  predicted: number;
  points: number;
}

/** Balance de la velada para el usuario: peleas, terminadas, aciertos y puntos. */
export function cardSummary(fixtures: MatchdayFixture[]): CardSummary {
  const fights = fixtures.filter((f) => f.fight && f.status !== 'CANCELLED');
  const finished = fights.filter((f) => f.finished);
  const predicted = finished.filter((f) => f.predSign === '1' || f.predSign === '2');
  return {
    fights: fights.length,
    finished: finished.length,
    hits: predicted.filter((f) => f.predSign === f.fight!.winner).length,
    predicted: predicted.length,
    points: fights.reduce((sum, f) => sum + (f.pointsAwarded ?? 0), 0),
  };
}
