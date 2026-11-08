/**
 * Lógica pura de la pantalla de jornadas: etiquetas de jornada, borradores locales y el envío
 * de pronósticos. Sin React ni red, para poder probarla aparte.
 */
import type {
  FightMethod,
  MatchdayFixture,
  MatchdayPoints,
  MatchdayPredictionInput,
  SurvivorStatus,
} from '../types/api';
import { parseTennisScore, tennisScoreText } from './tennisScore';

/** Pronóstico en edición de un partido; los marcadores son el texto de los inputs. */
export interface DraftPrediction {
  homeScore: string;
  awayScore: string;
  sign: string;
  /** Pelea de la UFC: método elegido ('' o ausente si no). */
  method?: string;
  /** Pelea de la UFC: asalto elegido, como texto ('' o ausente si no). */
  round?: string;
}

/** Pronósticos en edición por id de partido. */
export type Draft = Record<string, DraftPrediction>;

export type MatchSign = '1' | 'X' | '2';

/** `UPCOMING`: todos los que no han terminado; `PENDING`: abiertos y sin pronóstico. */
export type StatusFilter = 'UPCOMING' | 'PENDING' | 'FINISHED';

/**
 * Si se puede predecir el empate: solo en el fútbol (y en las competiciones propias, sin deporte). En la NFL,
 * la NBA, el LoL, el tenis y la UFC se elige quién gana.
 */
export const allowsDraw = (sport: string | null | undefined): boolean =>
  sport == null || sport === 'FOOTBALL';

const OVERTIMES = /^(\d*)OT$/;
const PENALTIES = /^PEN (\d+)-(\d+)$/;

/**
 * Cómo acabó un partido terminado más allá del marcador, a partir de su `displayClock` (`MatchClock` en el
 * servidor): «prórroga» (`OT`, `AET`), «2 prórrogas» (`2OT`) o «4-2 en penaltis» (`PEN 4-2`). Si no, null.
 */
export const resultNote = (displayClock: string | null | undefined): string | null => {
  const clock = displayClock?.trim() ?? '';
  if (clock === 'AET') return 'prórroga';
  const overtime = OVERTIMES.exec(clock);
  if (overtime) {
    const count = Number(overtime[1] || 1);
    return count > 1 ? `${count} prórrogas` : 'prórroga';
  }
  const penalties = PENALTIES.exec(clock);
  return penalties ? `${penalties[1]}-${penalties[2]} en penaltis` : null;
};

/**
 * «Final» o, si hubo prórroga o penaltis, «Final · prórroga». En el tenis, con los juegos de cada set:
 * «Final · 6-4 3-6 7-6(5)».
 */
export const finishedLabel = (displayClock: string | null | undefined): string => {
  const tennis = parseTennisScore(displayClock);
  if (tennis) return `Final · ${tennisScoreText(tennis)}`;
  const note = resultNote(displayClock);
  return note ? `Final · ${note}` : 'Final';
};

/**
 * Etiqueta de un partido en juego con el reloj que manda el servidor (`MatchClock`): el cuarto en la NBA y
 * la NFL («En juego · 3.er cuarto · 5:00»), el minuto en fútbol («En juego · 67'») o «Descanso». Sin reloj,
 * «En juego».
 */
export const liveLabel = (displayClock: string | null | undefined): string => {
  const clock = displayClock?.trim() ?? '';
  if (!clock || resultNote(clock)) return 'En juego';
  return clock === 'Descanso' ? clock : `En juego · ${clock}`;
};

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

const DATE_ROUND = /^Fecha (\d{4})-(\d{2})-(\d{2})$/;
/** Semana de una liga que junta varias competiciones, por la fecha de su lunes. */
const WEEK_ROUND = /^Semana (\d{4})-(\d{2})-(\d{2})$/;
const WEEK_DAY_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const ROUND_DAY_FORMAT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

/** Texto que se muestra para una jornada: «Fecha 2026-11-24» pasa a «Martes 24 nov»; el resto no cambia. */
/** Rondas eliminatorias tal como llegan del proveedor. */
const KNOCKOUT_LABELS: Record<string, string> = {
  playoff: 'Playoff',
  r32: 'Dieciseisavos',
  r16: 'Octavos de final',
  qf: 'Cuartos de final',
  sf: 'Semifinales',
  third: 'Tercer puesto',
  final: 'Final',
};

export function displayRoundLabel(label: string): string {
  if (KNOCKOUT_LABELS[label]) return KNOCKOUT_LABELS[label];
  const week = WEEK_ROUND.exec(label);
  if (week) {
    const monday = new Date(+week[1], +week[2] - 1, +week[3]);
    return `Semana del ${WEEK_DAY_FORMAT.format(monday).replace('.', '')}`;
  }
  const match = DATE_ROUND.exec(label);
  if (!match) return label;
  const text = ROUND_DAY_FORMAT.format(new Date(+match[1], +match[2] - 1, +match[3]))
    .replace(',', '')
    .replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const LIVE_STATUSES = new Set(['LIVE', 'PAUSED', 'IN_PLAY', 'IN_PROGRESS']);

/** El partido está en juego: solo si lo marca el proveedor (ESPN), nunca deducido por la hora. */
export const isLiveFixture = (fixture: MatchdayFixture): boolean =>
  !fixture.finished && LIVE_STATUSES.has((fixture.status ?? '').toUpperCase());

/**
 * Algún partido ya debería haber empezado y no ha terminado: se refresca a menudo para recibir su
 * estado. No dice que esté en directo (eso es `isLiveFixture`).
 */
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

interface RoundList {
  rounds: string[];
  /** Primera jornada con partidos sin terminar; si todo ha terminado, la última. */
  current: string | null;
}

/** «Jornada 13» o, en la NFL, «Semana 9» (no «Semana 2026-11-02», que es de varias competiciones). */
const matchdayNumber = (label: string): number | null => {
  const match = /^(?:jornada|semana)\s+(\d+)$/i.exec(label.trim());
  return match ? Number(match[1]) : null;
};

/**
 * Ordena por número las jornadas «Jornada N» (un aplazado no adelanta una jornada a otra) sin
 * mover de su sitio las demás etiquetas, como las rondas de eliminatoria.
 */
export function sortNumberedRounds(rounds: string[]): string[] {
  const numbered = rounds
    .filter((r) => matchdayNumber(r) !== null)
    .sort((a, b) => (matchdayNumber(a) ?? 0) - (matchdayNumber(b) ?? 0));
  let next = 0;
  return rounds.map((r) => (matchdayNumber(r) !== null ? numbered[next++] : r));
}

/** Jornadas en el orden de los partidos (las numeradas, por número), con la jornada actual. */
export function roundsFromFixtures(fixtures: MatchdayFixture[]): RoundList {
  const seen = new Set<string>();
  fixtures.forEach((f) => seen.add(roundLabelFor(f)));
  const rounds = sortNumberedRounds([...seen]);
  if (rounds.length === 0) return { rounds, current: null };

  let activeIndex = rounds.findIndex((r) =>
    fixtures.some((f) => roundLabelFor(f) === r && !f.finished),
  );
  if (activeIndex === -1) activeIndex = rounds.length - 1;
  return { rounds, current: rounds[activeIndex] };
}

/** Jornadas del resumen por jornada de la liga (`/leaderboard/matchdays`). */
export function roundsFromMatchdays(matchdays: MatchdayPoints[]): RoundList {
  const rounds = matchdays.map((m) => m.label);
  const current = matchdays.find((m) => m.current)?.label ?? rounds[rounds.length - 1] ?? null;
  return { rounds, current };
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

interface MergedDraft {
  /** Lo que muestran los inputs de cada partido recibido. */
  predictions: Draft;
  /** Borrador que se conserva: el de los partidos abiertos y el de los que no han llegado. */
  draft: Draft;
}

/**
 * Combina los partidos del servidor con el borrador local.
 *
 * En un partido abierto manda el borrador; en uno bloqueado, lo guardado en el servidor, y su
 * borrador se descarta. El borrador de los partidos que no vienen en `fixtures` (otras jornadas)
 * se conserva tal cual.
 */
export function mergeDraftWithServer(fixtures: MatchdayFixture[], draft: Draft): MergedDraft {
  const predictions: Draft = {};
  const kept: Draft = { ...draft };
  fixtures.forEach((f) => {
    const d = draft[f.matchId];
    const useDraft = !f.locked && Boolean(d) && typeof d === 'object';
    if (!useDraft) delete kept[f.matchId];
    const base = useDraft
      ? { homeScore: d.homeScore ?? '', awayScore: d.awayScore ?? '', sign: d.sign || '' }
      : {
          homeScore: scoreText(f.predHomeScore),
          awayScore: scoreText(f.predAwayScore),
          sign: f.predSign || '',
        };
    predictions[f.matchId] = f.fight
      ? {
          ...base,
          method: useDraft ? d.method || '' : f.predMethod || '',
          round: useDraft ? d.round || '' : scoreText(f.predRound ?? null),
        }
      : base;
  });
  return { predictions, draft: kept };
}

/**
 * Predicción de una pelea: quién gana ('1' o '2') y, si se quiere, el método y el asalto. El asalto
 * solo se guarda con un KO/TKO o una sumisión.
 */
export const withFightPick = (
  sign: '1' | '2',
  method: FightMethod | '' = '',
  round = '',
): DraftPrediction => ({
  homeScore: '',
  awayScore: '',
  sign,
  method,
  round: method === 'KO_TKO' || method === 'SUBMISSION' ? round : '',
});

/** Bloques de la cartelera, de la estelar a los preliminares tempranos. */
const SEGMENT_RANK: Record<string, number> = { MAIN: 0, PRELIMS: 1, EARLY_PRELIMS: 2 };

/** Peleas en el orden de la cartelera: la estelar arriba; las canceladas, al final. */
export function sortFightCard(fixtures: MatchdayFixture[]): MatchdayFixture[] {
  if (!fixtures.some((f) => f.fight)) return fixtures;
  const rank = (f: MatchdayFixture) => [
    f.status === 'CANCELLED' ? 1 : 0,
    SEGMENT_RANK[f.fight?.segment ?? ''] ?? 3,
    f.fight?.order ?? 99,
  ];
  return [...fixtures].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
}

/** Elige un signo 1X2. El pronóstico es solo de signo: se descarta cualquier marcador anterior. */
export const withSign = (sign: MatchSign): DraftPrediction => ({
  homeScore: '',
  awayScore: '',
  sign,
});

/** Sets que puede ganar quien pierde: 0 o 1 al mejor de tres; 0, 1 o 2 al mejor de cinco. */
export const tennisLoserSets = (setsToWin: number): number[] =>
  Array.from({ length: Math.max(0, setsToWin) }, (_, sets) => sets);

/**
 * Tenis: gana `sign` y, si se eligen, con estos sets para el que pierde (3-1 es `loserSets` 1).
 * Sin sets queda solo el ganador.
 */
export function tennisPick(
  sign: '1' | '2',
  setsToWin: number,
  loserSets: number | null,
): DraftPrediction {
  if (loserSets == null) return withSign(sign);
  const winner = String(setsToWin);
  const loser = String(loserSets);
  return sign === '1'
    ? { homeScore: winner, awayScore: loser, sign }
    : { homeScore: loser, awayScore: winner, sign };
}

/** Sets del que pierde en un pronóstico de tenis, o null si solo tiene ganador. */
export function tennisPickedLoserSets(prediction: DraftPrediction): number | null {
  if (prediction.homeScore === '' || prediction.awayScore === '') return null;
  return Math.min(Number(prediction.homeScore), Number(prediction.awayScore));
}

/** Ganador de un pronóstico de tenis: el signo o, si solo hay sets, quien tiene más. */
export function tennisPickedSign(prediction: DraftPrediction): '1' | '2' | null {
  if (prediction.sign === '1' || prediction.sign === '2') return prediction.sign;
  if (prediction.homeScore === '' || prediction.awayScore === '') return null;
  const home = Number(prediction.homeScore);
  const away = Number(prediction.awayScore);
  return home > away ? '1' : away > home ? '2' : null;
}

type Submission =
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
    const item: MatchdayPredictionInput = {
      matchId,
      homeScore: pred.homeScore !== '' ? parseInt(pred.homeScore, 10) : null,
      awayScore: pred.awayScore !== '' ? parseInt(pred.awayScore, 10) : null,
      sign: pred.sign || null,
    };
    if (fixture.fight) {
      item.method = (pred.method || null) as FightMethod | null;
      item.round = pred.round ? parseInt(pred.round, 10) : null;
    }
    items.push(item);
  });
  if (incomplete) return { kind: 'incomplete' };
  return items.length ? { kind: 'ready', items } : { kind: 'empty' };
}

/**
 * Borrador sin lo que ya se ha guardado. Un partido que se ha vuelto a cambiar mientras se
 * guardaba conserva el cambio nuevo, para enviarlo en el siguiente guardado.
 */
export function withoutSaved(draft: Draft, saved: MatchdayPredictionInput[]): Draft {
  const rest = { ...draft };
  saved.forEach((item) => {
    const current = rest[item.matchId];
    if (!current) return;
    const same =
      (current.sign || null) === item.sign &&
      (current.homeScore === '' ? null : parseInt(current.homeScore, 10)) === item.homeScore &&
      (current.awayScore === '' ? null : parseInt(current.awayScore, 10)) === item.awayScore &&
      (current.method || null) === (item.method ?? null) &&
      (current.round ? parseInt(current.round, 10) : null) === (item.round ?? null);
    if (same) delete rest[item.matchId];
  });
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
  // Los partidos en juego van primero; el resto conserva su orden.
  const upcoming = fixtures.filter((f) => !f.finished);
  return [
    ...upcoming.filter((f) => isLiveFixture(f)),
    ...upcoming.filter((f) => !isLiveFixture(f)),
  ];
}

/** Fecha corta de un partido: «sáb 12 oct, 18:00». Sin fecha válida, devuelve `missing`. */
export function formatMatchDate(
  dateStr: string | null | undefined,
  missing = 'Fecha por confirmar',
): string {
  if (!dateStr) return missing;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return missing;
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Superviviente: equipos ya elegidos en otras jornadas (no se pueden repetir), con la jornada en
 * que se usaron. La elección de la jornada abierta se puede cambiar, así que no cuenta.
 */
export function survivorUsedTeams(
  status: SurvivorStatus | null | undefined,
  activeRound: string | null,
): Map<number, string> {
  const used = new Map<number, string>();
  status?.picks.forEach((pick) => {
    if (pick.teamId != null && pick.round !== activeRound) used.set(pick.teamId, pick.round);
  });
  return used;
}
