/**
 * Lógica pura de la pantalla de jornadas: etiquetas de jornada, borradores locales y el envío
 * de pronósticos. Sin React ni red, para poder probarla aparte.
 */
import type { MatchdayFixture, MatchdayPredictionInput } from '../types/api';

/** Pronóstico en edición de un partido; los marcadores son el texto de los inputs. */
export interface DraftPrediction {
  homeScore: string;
  awayScore: string;
  sign: string;
}

/** Pronósticos en edición por id de partido. */
export type Draft = Record<string, DraftPrediction>;

export type MatchSign = '1' | 'X' | '2';

export type StatusFilter = 'ALL' | 'PENDING' | 'FINISHED';

export const EMPTY_PREDICTION: DraftPrediction = { homeScore: '', awayScore: '', sign: '' };

/** Jornada visible de un partido; es la misma etiqueta que usa el backend (`MatchRound.label`). */
export const roundLabelFor = (fixture: MatchdayFixture): string =>
  fixture.groupName
    ? `Grupo ${fixture.groupName}`
    : fixture.round && fixture.round !== 'group'
      ? fixture.round
      : fixture.matchDate
        ? `Fecha ${fixture.matchDate.slice(0, 10)}`
        : 'Sin jornada';

/** Hay algún partido empezado y sin terminar. */
export const hasLiveMatch = (
  fixtures: MatchdayFixture[] | undefined,
  now: number = Date.now(),
): boolean =>
  Boolean(
    fixtures?.some((f) => !f.finished && f.matchDate != null && Date.parse(f.matchDate) <= now),
  );

/** El pronóstico tiene los dos marcadores o, al menos, un signo. */
export const hasPrediction = (prediction: DraftPrediction | undefined): boolean =>
  Boolean(
    prediction && ((prediction.homeScore !== '' && prediction.awayScore !== '') || prediction.sign),
  );

export interface RoundList {
  rounds: string[];
  /** Primera jornada con partidos sin terminar; si todo ha terminado, la última. */
  current: string | null;
}

/** Jornadas en el orden en que aparecen los partidos, con la jornada actual. */
export function roundsFromFixtures(fixtures: MatchdayFixture[]): RoundList {
  const rounds: string[] = [];
  const seen = new Set<string>();
  fixtures.forEach((f) => {
    const label = roundLabelFor(f);
    if (!seen.has(label)) {
      seen.add(label);
      rounds.push(label);
    }
  });
  if (rounds.length === 0) return { rounds, current: null };

  let activeIndex = rounds.findIndex((r) =>
    fixtures.some((f) => roundLabelFor(f) === r && !f.finished),
  );
  if (activeIndex === -1) activeIndex = rounds.length - 1;
  return { rounds, current: rounds[activeIndex] };
}

/** Jornada que se muestra: la elegida si existe; si no, la actual o la primera. */
export const resolveRound = (selected: string | null, { rounds, current }: RoundList) =>
  selected && rounds.includes(selected) ? selected : (current ?? rounds[0] ?? null);

/** Interpreta el borrador guardado; `null` si no hay o no es un objeto. */
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Draft) : null;
}

const scoreText = (score: number | null | undefined) =>
  score !== null && score !== undefined ? String(score) : '';

export interface MergedDraft {
  /** Lo que muestran los inputs de cada partido recibido. */
  predictions: Draft;
  /** Borrador que se conserva: el de los partidos abiertos. */
  draft: Draft;
}

/**
 * Combina los partidos del servidor con el borrador local.
 *
 * En un partido abierto manda el borrador; en uno bloqueado, lo guardado en el servidor, y su
 * borrador se descarta.
 */
export function mergeDraftWithServer(fixtures: MatchdayFixture[], draft: Draft): MergedDraft {
  const predictions: Draft = {};
  const kept: Draft = {};
  fixtures.forEach((f) => {
    const d = draft[f.matchId];
    const useDraft = !f.locked && Boolean(d) && typeof d === 'object';
    if (useDraft) kept[f.matchId] = d;
    predictions[f.matchId] = useDraft
      ? { homeScore: d.homeScore ?? '', awayScore: d.awayScore ?? '', sign: d.sign || '' }
      : {
          homeScore: scoreText(f.predHomeScore),
          awayScore: scoreText(f.predAwayScore),
          sign: f.predSign || '',
        };
  });
  return { predictions, draft: kept };
}

/** Cambia un marcador (solo dígitos, máximo dos) y recalcula el signo si están los dos. */
export function withScore(
  current: DraftPrediction,
  side: 'home' | 'away',
  value: string,
): DraftPrediction {
  const clean = value.replace(/[^0-9]/g, '').slice(0, 2);
  const updated = { ...current, [side === 'home' ? 'homeScore' : 'awayScore']: clean };
  if (updated.homeScore !== '' && updated.awayScore !== '') {
    const h = parseInt(updated.homeScore, 10);
    const a = parseInt(updated.awayScore, 10);
    updated.sign = h > a ? '1' : h === a ? 'X' : '2';
  } else {
    updated.sign = '';
  }
  return updated;
}

/** Elige un signo y ajusta el marcador para que sea coherente con él. */
export function withSign(current: DraftPrediction, sign: MatchSign): DraftPrediction {
  let h = current.homeScore;
  let a = current.awayScore;
  if (sign === '1' && (h === '' || a === '' || Number(h) <= Number(a))) {
    h = '2';
    a = '1';
  } else if (sign === 'X') {
    h = '1';
    a = '1';
  } else if (sign === '2' && (a === '' || h === '' || Number(a) <= Number(h))) {
    h = '1';
    a = '2';
  }
  return { homeScore: h, awayScore: a, sign };
}

export type Submission =
  { kind: 'incomplete' } | { kind: 'empty' } | { kind: 'ready'; items: MatchdayPredictionInput[] };

/**
 * Pronósticos del borrador que se envían: los de partidos de la jornada que siguen abiertos.
 * Un marcador a medias bloquea el envío.
 */
export function buildSubmission(fixtures: MatchdayFixture[], draft: Draft): Submission {
  const byId = new Map(fixtures.map((f) => [f.matchId, f]));
  const items: MatchdayPredictionInput[] = [];
  let incomplete = false;
  Object.entries(draft).forEach(([matchIdStr, pred]) => {
    const matchId = Number(matchIdStr);
    const fixture = byId.get(matchId);
    if (!fixture || fixture.locked) return;
    if ((pred.homeScore === '') !== (pred.awayScore === '')) {
      incomplete = true;
      return;
    }
    if (!hasPrediction(pred)) return;
    items.push({
      matchId,
      homeScore: pred.homeScore !== '' ? parseInt(pred.homeScore, 10) : null,
      awayScore: pred.awayScore !== '' ? parseInt(pred.awayScore, 10) : null,
      sign: pred.sign || null,
    });
  });
  if (incomplete) return { kind: 'incomplete' };
  return items.length ? { kind: 'ready', items } : { kind: 'empty' };
}

/** Borrador sin los partidos ya guardados. */
export function withoutSaved(draft: Draft, savedMatchIds: number[]): Draft {
  const rest = { ...draft };
  savedMatchIds.forEach((id) => delete rest[id]);
  return rest;
}

/** Partido que aún se puede pronosticar y no tiene pronóstico. */
export const isPendingFixture = (
  fixture: MatchdayFixture,
  predictions: Draft,
  leagueLocked: boolean,
) => !fixture.locked && !leagueLocked && !hasPrediction(predictions[fixture.matchId]);

export function filterFixtures(
  fixtures: MatchdayFixture[],
  filter: StatusFilter,
  predictions: Draft,
  leagueLocked: boolean,
): MatchdayFixture[] {
  if (filter === 'PENDING')
    return fixtures.filter((f) => isPendingFixture(f, predictions, leagueLocked));
  if (filter === 'FINISHED') return fixtures.filter((f) => f.finished);
  return fixtures;
}

export function formatMatchDate(dateStr: string | null): string {
  if (!dateStr) return 'Fecha por confirmar';
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
