import type { CreateGroupRequest, CustomLockMode } from '../../services/api';
import type { CardSegment, Competition, EventSeries, PoolFormat, Sport } from '../../types/api';
import { CARD_SEGMENTS } from '../../utils/fights';
import {
  SCORING_MAX_POINTS,
  defaultScoringRules,
  draftToRules,
  sameRules,
  toDraft,
  type ScoringDraft,
} from '../../utils/scoringRules';
import { isMatchBasedFormat } from '../../utils/poolFormat';
import { isWorldCupCompetition } from '../../context/leagueKind';
import { isNbaCompetition } from '../../utils/nbaPlayoffs';
import {
  BRACKET_LOCK_MODES,
  DRAWN_KNOCKOUT_LOCK_MODES,
  FIGHT_NIGHT_LOCK_MODES,
  LOCK_UNIT_MINUTES,
  matchdayLockModes,
  MAX_LOCK_OFFSET_MINUTES,
  SERIES_LOCK_MODES,
  SINGLE_LOCK_MODES,
  type LockModeOption,
  type LockUnit,
} from '../groups/custom/lockModes';
import {
  ALL_MATCHES,
  isMultiCompetition,
  selectionError,
  toRequest,
  type PickMode,
  type SelectionValue,
} from '../matchSelection/matchSelection';

export const LEAGUE_STEPS = [
  { id: 'sport', label: 'Deporte' },
  { id: 'competition', label: 'Competición' },
  { id: 'format', label: 'Modo de juego' },
  { id: 'rules', label: 'Reglas' },
  { id: 'identity', label: 'Identidad' },
  { id: 'summary', label: 'Resumen' },
] as const;

export type LeagueStepId = (typeof LEAGUE_STEPS)[number]['id'];

export const NAME_MAX = 120;
export const CUSTOM_NAME_MAX = 100;
export const RULES_MAX = 8000;

/** Deporte elegido: uno con competiciones oficiales u «otro», que solo admite una personalizada. */
export type SportChoice = Sport | 'OTHER';

export const SPORT_LABELS: Record<SportChoice, string> = {
  FOOTBALL: 'Fútbol',
  LEAGUE_OF_LEGENDS: 'League of Legends',
  FORMULA_1: 'Fórmula 1',
  BASKETBALL: 'Baloncesto',
  AMERICAN_FOOTBALL: 'Fútbol americano',
  TENNIS: 'Tenis',
  MMA: 'UFC',
  OTHER: 'Otro deporte',
};

/** Las competiciones guardadas antes de que el servidor mandara el deporte son de fútbol. */
const competitionSport = (competition: Competition): Sport =>
  competition.sport ??
  (competition.externalId?.startsWith('lol.')
    ? 'LEAGUE_OF_LEGENDS'
    : competition.externalId?.startsWith('mma.')
      ? 'MMA'
      : competition.externalId === 'f1'
        ? 'FORMULA_1'
        : isNbaCompetition(competition.externalId)
          ? 'BASKETBALL'
          : competition.externalId === 'nfl'
            ? 'AMERICAN_FOOTBALL'
            : competition.externalId?.startsWith('tennis.')
              ? 'TENNIS'
              : 'FOOTBALL');

/** Cuadro de un torneo de tenis que entra en la liga. */
export type TennisDraw = 'MEN' | 'WOMEN' | 'BOTH';

/** UFC: qué veladas sigue una liga con todas (sin serie, todas). */
export const EVENT_SERIES_LABELS: Record<EventSeries, string> = {
  NUMBERED: 'Solo las numeradas',
  FIGHT_NIGHT: 'Solo las Fight Night',
};

export const TENNIS_DRAW_LABELS: Record<TennisDraw, string> = {
  MEN: 'Masculino',
  WOMEN: 'Femenino',
  BOTH: 'Los dos',
};

/** Cuadro de tenis de un torneo (por su id en ESPN), si existe y no ha terminado. */
const tennisCompetition = (
  ctx: DraftContext,
  tournamentId: number,
  draw: 'MEN' | 'WOMEN',
): Competition | undefined =>
  ctx.competitions.find(
    (item) =>
      item.tennis?.tournamentId === tournamentId && item.tennis.draw === draw && !item.finished,
  );

/** Cuadros que se pueden elegir en un torneo: los dos solo si tiene cuadro femenino. */
export function tennisDrawChoices(ctx: DraftContext, tournamentId: number): TennisDraw[] {
  const men = tennisCompetition(ctx, tournamentId, 'MEN');
  const women = tennisCompetition(ctx, tournamentId, 'WOMEN');
  if (men && women) return ['MEN', 'WOMEN', 'BOTH'];
  return women ? ['WOMEN'] : ['MEN'];
}

/** Competiciones en las que aún se puede crear una liga: las terminadas no se ofrecen. */
const openCompetitions = (ctx: DraftContext) => ctx.competitions.filter((item) => !item.finished);

/** Deportes con competiciones oficiales abiertas, en el orden en que llegan, y «otro» al final. */
export function sportChoices(ctx: DraftContext): SportChoice[] {
  const sports = [...new Set(openCompetitions(ctx).map(competitionSport))];
  return [...sports, 'OTHER'];
}

/** Por qué no se puede crear una liga sobre esta competición, o null si se puede. */
export const competitionUnavailableReason = (competition: Competition) =>
  competition.finished ? 'Ya ha terminado: no quedan partidos por jugar.' : null;

export const competitionsOfSport = (ctx: DraftContext, sport: SportChoice | null) =>
  openCompetitions(ctx).filter((item) => competitionSport(item) === sport);

/** Lo que lleva elegido quien crea la liga. Se guarda tal cual en el dispositivo. */
export interface LeagueDraft {
  sport: SportChoice | null;
  /** Competición oficial elegida; null si no hay o si es personalizada. */
  competitionId: number | null;
  custom: boolean;
  customName: string;
  poolFormat: PoolFormat | null;
  lockMode: CustomLockMode | null;
  /** Margen tal como se escribe en el campo. */
  lockAmount: string;
  lockUnit: LockUnit;
  /** `YYYY-MM-DDTHH:mm`, para el cierre en una fecha fija. */
  lockDate: string;
  customScoring: boolean;
  scoring: ScoringDraft;
  pichichi: boolean;
  /** Partidos que entran (liga por jornadas sobre una competición oficial). */
  matches: SelectionValue;
  /** Competición a la que pertenecen los partidos elegidos: si cambia, se vuelve a todos. */
  matchesCompetitionId: number | null;
  /** Tenis: qué cuadros del torneo entran (la competición elegida es la masculina si son los dos). */
  tennisDraw: TennisDraw;
  /** UFC con todas las veladas: solo las numeradas o solo las Fight Night; null para todas. */
  eventSeries: EventSeries | null;
  /** UFC: partes de la cartelera de cada velada que entran (las tres, la velada completa). */
  cardSegments: CardSegment[];
  entryFee: boolean;
  name: string;
  rules: string;
  /** Imagen ya recortada, como data URL; se sube al crear la liga. */
  image: string | null;
  /** Clave de idempotencia del envío en curso: un reintento devuelve la misma liga. */
  creationKey: string | null;
}

export const emptyDraft = (): LeagueDraft => ({
  sport: null,
  competitionId: null,
  custom: false,
  customName: '',
  poolFormat: null,
  lockMode: null,
  lockAmount: '0',
  lockUnit: 'hours',
  lockDate: '',
  customScoring: false,
  scoring: toDraft(defaultScoringRules(null)),
  pichichi: false,
  matches: ALL_MATCHES,
  matchesCompetitionId: null,
  tennisDraw: 'MEN',
  eventSeries: null,
  cardSegments: [...CARD_SEGMENTS],
  entryFee: false,
  name: '',
  rules: '',
  image: null,
  creationKey: null,
});

/** Competiciones disponibles; la elegida se busca aquí. */
export interface DraftContext {
  competitions: Competition[];
}

export const selectedCompetition = (draft: LeagueDraft, ctx: DraftContext) =>
  draft.custom || draft.competitionId == null
    ? null
    : (ctx.competitions.find((item) => item.id === draft.competitionId) ?? null);

const hasCompetition = (draft: LeagueDraft, ctx: DraftContext) =>
  draft.custom || selectedCompetition(draft, ctx) != null;

const POOL_FORMAT_ORDER: PoolFormat[] = [
  'MATCH_DAY',
  'SURVIVOR',
  'FULL_BRACKET',
  'KNOCKOUTS_ONLY',
  'GRAND_PRIX',
];

/** Modos que se ofrecen para el deporte elegido: la Fórmula 1 solo se juega por Grandes Premios. */
export const formatsForSport = (sport: SportChoice | null): PoolFormat[] =>
  sport === 'FORMULA_1'
    ? ['GRAND_PRIX']
    : POOL_FORMAT_ORDER.filter((format) => format !== 'GRAND_PRIX');

/** Cómo se juega cada formato, contado a quien aún no lo conoce. */
const FORMAT_COPY: Record<PoolFormat, { title: string; text: string }> = {
  MATCH_DAY: {
    title: 'Por jornadas',
    text: 'En cada jornada predices quién gana cada partido: 1, X o 2. Cada acierto suma y gana quien más puntos lleve al final.',
  },
  SURVIVOR: {
    title: 'Superviviente',
    text: 'En cada jornada eliges un equipo que gane, sin repetir equipo. Si no gana, o si no eliges, quedas fuera; la liga puede dar vidas extra o salvar el empate. Gana quien aguante más jornadas.',
  },
  FULL_BRACKET: {
    title: 'Cuadro completo',
    text: 'Antes de empezar rellenas la fase de grupos y el cuadro hasta el campeón. Suma cada equipo que aciertas en cada ronda.',
  },
  KNOCKOUTS_ONLY: {
    title: 'Solo eliminatorias',
    text: 'Rellenas el cuadro desde la primera eliminatoria hasta la final, sin fase de grupos.',
  },
  GRAND_PRIX: {
    title: 'Gran Premio a Gran Premio',
    text: 'Antes de cada clasificación predices el podio, la pole y la vuelta rápida. Los resultados llegan solos al acabar la carrera y gana quien más puntos sume en la temporada.',
  },
};

/** Un torneo de tenis se juega partido a partido, desde octavos. */
const TENNIS_COPY = {
  title: 'Partido a partido',
  text: 'Desde octavos eliges quién gana cada partido y, si te atreves, en cuántos sets. Cada ronda vale más que la anterior y cada partido se cierra al empezar.',
};

/** Solo eliminatorias en una competición que las sortea ronda a ronda (Champions, Copa del Rey…). */
const KNOCKOUT_DRAW_COPY = {
  title: 'Solo eliminatorias',
  text: 'Tras cada sorteo eliges quién pasa cada eliminatoria, ronda a ronda hasta el campeón. En las de ida y vuelta cuenta quién pasa, no cada partido.',
};

/** Por veladas (la UFC): en cada velada se predice cada pelea. */
const FIGHT_NIGHTS_COPY = {
  title: 'Por veladas',
  text: 'En cada velada predices quién gana cada pelea y, si quieres, cómo acaba (KO/TKO, sumisión o decisión) y en qué asalto. Cada acierto suma.',
};

/** La competición elegida se juega por veladas (la UFC), no por jornadas. */
export const isFightNights = (draft: LeagueDraft, ctx: DraftContext) =>
  selectedCompetition(draft, ctx)?.formatType === 'EVENTS';

/** Playoffs de la NBA: series del play-in a las Finales. */
const NBA_PLAYOFFS_COPY = {
  title: 'Playoffs',
  text: 'Eliges quién gana cada serie, del play-in a las Finales, y en cuántos partidos (4-0, 4-1…). Cada serie se cierra al empezar su primer partido.',
};

/** La competición elegida son los playoffs de la NBA. */
export const isNbaDraft = (draft: LeagueDraft, ctx: DraftContext) =>
  isNbaCompetition(selectedCompetition(draft, ctx)?.externalId);

/** Las eliminatorias de la competición elegida se sortean ronda a ronda. */
export const isKnockoutDraw = (draft: LeagueDraft, ctx: DraftContext) =>
  Boolean(selectedCompetition(draft, ctx)?.knockoutDraw);

/** Por jornadas y superviviente en la NFL: semana a semana y sin empate. */
const NFL_FORMAT_COPY: Partial<Record<PoolFormat, { title: string; text: string }>> = {
  MATCH_DAY: {
    title: 'Por semanas',
    text: 'Cada semana, y en los playoffs hasta la Super Bowl, predices quién gana cada partido. Cada acierto suma y gana quien más puntos lleve al final.',
  },
  SURVIVOR: {
    title: 'Superviviente',
    text: 'Cada semana eliges un equipo que gane, sin repetir equipo. Si pierde, o si no eliges, quedas fuera; la liga puede dar vidas extra. Gana quien aguante más semanas.',
  },
};

/** Cómo se juega un formato con la competición elegida. */
export function formatCopy(format: PoolFormat, draft: LeagueDraft, ctx: DraftContext) {
  if (format === 'MATCH_DAY' && isFightNights(draft, ctx)) return FIGHT_NIGHTS_COPY;
  if (draft.sport === 'TENNIS' && format === 'MATCH_DAY') return TENNIS_COPY;
  if (format === 'KNOCKOUTS_ONLY' && isNbaDraft(draft, ctx)) return NBA_PLAYOFFS_COPY;
  if (format === 'KNOCKOUTS_ONLY' && isKnockoutDraw(draft, ctx)) return KNOCKOUT_DRAW_COPY;
  return (draft.sport === 'AMERICAN_FOOTBALL' && NFL_FORMAT_COPY[format]) || FORMAT_COPY[format];
}

/** Por qué un formato no se puede elegir con esta competición, o null si se puede. */
export function formatUnavailableReason(
  format: PoolFormat,
  draft: LeagueDraft,
  ctx: DraftContext,
): string | null {
  if (draft.sport === 'TENNIS' && format !== 'MATCH_DAY') {
    return 'En tenis se predice partido a partido.';
  }
  if (format === 'SURVIVOR' && draft.custom) {
    // Sin resultados automáticos no se sabría quién cae.
    return 'Necesita una competición oficial: los resultados llegan solos y así se sabe quién cae.';
  }
  const competition = selectedCompetition(draft, ctx);
  if (competition?.formatType === 'EVENTS' && format !== 'MATCH_DAY') {
    return 'La UFC se juega velada a velada: elige Por veladas.';
  }
  const formulaOne = competition?.formatType === 'RACE';
  if (format === 'GRAND_PRIX' && !formulaOne) return 'Solo para la Fórmula 1.';
  if (format !== 'GRAND_PRIX' && formulaOne) {
    return 'La Fórmula 1 se juega Gran Premio a Gran Premio.';
  }
  if (format !== 'KNOCKOUTS_ONLY' && isNbaCompetition(competition?.externalId)) {
    return 'De la NBA se pronostican los playoffs, serie a serie.';
  }
  if (format === 'FULL_BRACKET' && competition?.knockoutDraw) {
    return 'Los cruces se sortean ronda a ronda: elige Solo eliminatorias.';
  }
  if (
    format === 'FULL_BRACKET' &&
    competition?.formatType === 'TOURNAMENT' &&
    competition.groupStage === false
  ) {
    return 'Este torneo no tiene fase de grupos: elige Solo eliminatorias.';
  }
  if (
    !isMatchBasedFormat(format) &&
    competition?.formatType === 'LEAGUE' &&
    !competition.knockoutDraw
  ) {
    return 'En PorrApp esta competición se juega por jornadas: no tiene cuadro que rellenar.';
  }
  return null;
}

/**
 * Competición personalizada o torneo oficial con cuadro propio: se cierra cruce a cruce. El cuadro
 * del Mundial se cierra de una vez, antes del torneo.
 */
const allowsProgressiveLock = (draft: LeagueDraft, ctx: DraftContext) => {
  if (draft.custom) return true;
  const competition = selectedCompetition(draft, ctx);
  return competition?.formatType === 'TOURNAMENT' && !isWorldCupCompetition(competition.externalId);
};

/** Cierres que admite el formato elegido. Superviviente se pronostica partido a partido: como jornadas. */
export function lockModesFor(draft: LeagueDraft, ctx: DraftContext): LockModeOption[] {
  // Cada Gran Premio se cierra al empezar su clasificación: no hay nada que elegir.
  if (draft.poolFormat == null || draft.poolFormat === 'GRAND_PRIX') return [];
  if (draft.poolFormat === 'MATCH_DAY' && isFightNights(draft, ctx)) return FIGHT_NIGHT_LOCK_MODES;
  if (isMatchBasedFormat(draft.poolFormat))
    return matchdayLockModes(isMultiCompetition(draft.matches));
  if (isNbaDraft(draft, ctx)) return SERIES_LOCK_MODES;
  if (isKnockoutDraw(draft, ctx)) return DRAWN_KNOCKOUT_LOCK_MODES;
  return allowsProgressiveLock(draft, ctx) ? BRACKET_LOCK_MODES : SINGLE_LOCK_MODES;
}

/**
 * Cierre propuesto. En un cuadro con rondas, por rondas: nunca falla aunque la competición ya haya
 * empezado. Sin rondas, al empezar el primer partido.
 */
function defaultLockMode(draft: LeagueDraft, ctx: DraftContext): CustomLockMode | null {
  const modes = lockModesFor(draft, ctx);
  if (modes.length === 0) return null;
  if (draft.poolFormat === 'MATCH_DAY' && isFightNights(draft, ctx)) return 'PER_ROUND';
  if (isMatchBasedFormat(draft.poolFormat) || isNbaDraft(draft, ctx)) return 'PER_MATCH';
  return modes.some((item) => item.value === 'PER_ROUND') ? 'PER_ROUND' : 'FIRST_MATCH';
}

/**
 * El pichichi se puntúa con los goleadores oficiales del Mundial: solo en su cuadro (ni en sus
 * jornadas ni en otros torneos).
 */
export const pichichiApplies = (draft: LeagueDraft, ctx: DraftContext) =>
  !draft.custom &&
  isWorldCupCompetition(selectedCompetition(draft, ctx)?.externalId) &&
  draft.poolFormat != null &&
  !isMatchBasedFormat(draft.poolFormat);

/** Elegir partidos: solo en una liga por jornadas sobre una competición oficial. */
export const matchSelectionApplies = (draft: LeagueDraft, ctx: DraftContext) =>
  !draft.custom &&
  draft.sport !== 'TENNIS' &&
  draft.poolFormat === 'MATCH_DAY' &&
  selectedCompetition(draft, ctx) != null;

/**
 * Tenis: la competición del cuadro elegido. Con los dos cuadros, la masculina es la principal y la
 * femenina entra como segunda competición de la liga.
 */
function normalizeTennis(next: LeagueDraft, ctx: DraftContext) {
  const tennis = ctx.competitions.find((item) => item.id === next.competitionId)?.tennis;
  if (!tennis) return;
  const choices = tennisDrawChoices(ctx, tennis.tournamentId);
  if (!choices.includes(next.tennisDraw)) next.tennisDraw = choices[0];
  const wanted = tennisCompetition(
    ctx,
    tennis.tournamentId,
    next.tennisDraw === 'WOMEN' ? 'WOMEN' : 'MEN',
  );
  next.competitionId = wanted?.id ?? null;
  // En tenis no hay otro modo de juego: queda elegido.
  next.poolFormat = 'MATCH_DAY';
}

/** Con el formato elegido, la puntuación se puede personalizar (en superviviente: puntos, vidas y empate). */
export const scoringEditable = (draft: LeagueDraft) => draft.poolFormat != null;

/**
 * Deja coherente lo que depende de elecciones anteriores: al cambiar de deporte, de competición o de
 * formato se quitan la competición, el formato, el cierre o el pichichi que ya no aplican.
 */
export function normalizeDraft(draft: LeagueDraft, ctx: DraftContext): LeagueDraft {
  const next = { ...draft };
  const chosen =
    next.competitionId == null
      ? null
      : ctx.competitions.find((item) => item.id === next.competitionId);
  // Un borrador de antes de existir este paso: el deporte es el de su competición.
  if (next.sport == null && chosen) next.sport = competitionSport(chosen);
  // Sin competiciones oficiales del deporte, solo cabe una personalizada.
  if (next.sport === 'OTHER') next.custom = true;
  if (chosen && (competitionSport(chosen) !== next.sport || chosen.finished))
    next.competitionId = null;
  if (next.custom) next.competitionId = null;
  if (next.sport === 'TENNIS') normalizeTennis(next, ctx);
  if (next.poolFormat && formatUnavailableReason(next.poolFormat, next, ctx))
    next.poolFormat = null;
  // Un solo modo posible (la Fórmula 1): queda elegido.
  const formats = formatsForSport(next.sport);
  if (
    next.poolFormat == null &&
    formats.length === 1 &&
    !formatUnavailableReason(formats[0], next, ctx)
  )
    next.poolFormat = formats[0];
  const modes = lockModesFor(next, ctx);
  if (!modes.some((item) => item.value === next.lockMode))
    next.lockMode = defaultLockMode(next, ctx);
  if (!pichichiApplies(next, ctx)) next.pichichi = false;
  // Los partidos elegidos son de una competición: al cambiarla (o el formato) entran todos.
  if (!matchSelectionApplies(next, ctx)) {
    if (next.matches.mode !== 'ALL') next.matches = ALL_MATCHES;
    next.matchesCompetitionId = null;
  } else if (next.matchesCompetitionId !== next.competitionId) {
    next.matches = ALL_MATCHES;
    next.matchesCompetitionId = next.competitionId;
  }
  // La serie solo cuenta en una liga de la UFC con todas las veladas.
  if (!matchSelectionApplies(next, ctx) || !isFightNights(next, ctx) || next.matches.mode !== 'ALL')
    next.eventSeries = null;
  // Las partes de la cartelera solo cuentan en la UFC; en otra competición, la velada completa.
  if (
    (!matchSelectionApplies(next, ctx) || !isFightNights(next, ctx)) &&
    next.cardSegments.length !== CARD_SEGMENTS.length
  )
    next.cardSegments = [...CARD_SEGMENTS];
  if (!scoringEditable(next)) next.customScoring = false;
  // Sin personalizar, la puntuación es la del deporte (la del tenis no es la del fútbol).
  if (!next.customScoring) {
    const defaults = toDraft(defaultScoringRules(next.sport));
    if (JSON.stringify(defaults) !== JSON.stringify(next.scoring)) next.scoring = defaults;
  }
  return next;
}

export const lockOffsetMinutes = (draft: LeagueDraft) =>
  Number(draft.lockAmount.trim()) * LOCK_UNIT_MINUTES[draft.lockUnit];

/** Errores del paso por campo; vacío si se puede seguir. */
export type StepErrors = Partial<
  Record<
    | 'sport'
    | 'competition'
    | 'customName'
    | 'poolFormat'
    | 'matches'
    | 'cardSegments'
    | 'lockDate'
    | 'lockAmount'
    | 'scoring'
    | 'name'
    | 'rules',
    string
  >
>;

/** Control de cada campo: se enfoca cuando tiene un error y enlaza su mensaje. */
export const FIELD_IDS: Record<keyof StepErrors, string> = {
  sport: 'cl-field-sport',
  competition: 'cl-field-competition',
  customName: 'cl-custom-name',
  poolFormat: 'cl-field-format',
  matches: 'cl-field-matches',
  cardSegments: 'cl-field-card-segments',
  lockDate: 'cl-lock-date',
  lockAmount: 'cl-lock-amount',
  scoring: 'cl-field-scoring',
  name: 'cl-name',
  rules: 'cl-rules',
};

export const errorId = (fieldId: string) => `${fieldId}-error`;

export function validateStep(
  step: LeagueStepId,
  draft: LeagueDraft,
  ctx: DraftContext,
  now: Date = new Date(),
): StepErrors {
  const errors: StepErrors = {};
  if (step === 'sport' && !draft.sport) errors.sport = 'Elige un deporte.';
  if (step === 'competition') {
    if (!hasCompetition(draft, ctx)) errors.competition = 'Elige una competición.';
    else if (draft.custom && !draft.customName.trim())
      errors.customName = 'Ponle nombre a tu competición.';
    else if (draft.custom && draft.customName.trim().length > CUSTOM_NAME_MAX)
      errors.customName = `Como máximo ${CUSTOM_NAME_MAX} caracteres.`;
  }
  if (step === 'format' && !draft.poolFormat) {
    errors.poolFormat = 'Elige cómo se juega la liga.';
  } else if (step === 'format' && matchSelectionApplies(draft, ctx)) {
    const problem =
      isFightNights(draft, ctx) && draft.matches.mode !== 'ALL' && !draft.matches.included.length
        ? 'Elige una velada.'
        : selectionError(draft.matches);
    if (problem) errors.matches = problem;
    if (isFightNights(draft, ctx) && !draft.cardSegments.length)
      errors.cardSegments = 'Marca al menos una parte de la cartelera.';
  }
  if (step === 'rules') {
    if (draft.lockMode === 'FIXED_DATE') {
      const date = new Date(draft.lockDate);
      if (!draft.lockDate) errors.lockDate = 'Elige la fecha y la hora de cierre.';
      else if (Number.isNaN(date.getTime()) || date <= now)
        errors.lockDate = 'La fecha de cierre tiene que ser futura.';
    } else if (draft.lockMode) {
      const amount = draft.lockAmount.trim();
      if (!/^\d+$/.test(amount)) errors.lockAmount = 'Escribe un número entero, 0 o más.';
      else if (lockOffsetMinutes(draft) > MAX_LOCK_OFFSET_MINUTES)
        errors.lockAmount = 'El margen máximo es de 30 días.';
    }
    if (draft.customScoring && !draftToRules(draft.scoring, SCORING_MAX_POINTS)) {
      errors.scoring = 'Revisa la puntuación: hay valores no válidos.';
    }
  }
  if (step === 'identity') {
    if (!draft.name.trim()) errors.name = 'Ponle nombre a la liga.';
    else if (draft.name.trim().length > NAME_MAX)
      errors.name = `Como máximo ${NAME_MAX} caracteres.`;
    if (draft.rules.length > RULES_MAX) errors.rules = `Como máximo ${RULES_MAX} caracteres.`;
  }
  return errors;
}

/** Primer paso con algo pendiente; el resumen si todo está listo. */
export function firstIncompleteStep(draft: LeagueDraft, ctx: DraftContext, now?: Date): number {
  const index = LEAGUE_STEPS.findIndex(
    (step) => Object.keys(validateStep(step.id, draft, ctx, now)).length > 0,
  );
  return index === -1 ? LEAGUE_STEPS.length - 1 : index;
}

/** Puntuación que se envía: solo si se ha personalizado y difiere de la de por defecto. */
export function customScoringRules(draft: LeagueDraft) {
  if (!draft.customScoring || !scoringEditable(draft)) return undefined;
  const rules = draftToRules(draft.scoring, SCORING_MAX_POINTS);
  return rules && !sameRules(rules, defaultScoringRules(draft.sport)) ? rules : undefined;
}

/** Petición de creación; da por hecho que todos los pasos son válidos. */
export function buildCreateRequest(draft: LeagueDraft, ctx: DraftContext): CreateGroupRequest {
  const competition = selectedCompetition(draft, ctx);
  const rules = draft.rules.trim();
  const request: CreateGroupRequest = {
    name: draft.name.trim(),
    competitionId: draft.custom ? null : (competition?.id ?? null),
    poolFormat: draft.poolFormat ?? 'MATCH_DAY',
    pichichi: pichichiApplies(draft, ctx) && draft.pichichi,
  };
  if (draft.custom) request.customCompetitionName = draft.customName.trim();
  if (rules) request.rules = rules;
  if (draft.entryFee) request.entryFee = true;
  // UFC: sin las tres partes de la cartelera, las elegidas (en el orden de la velada).
  const cardSegments =
    matchSelectionApplies(draft, ctx) &&
    isFightNights(draft, ctx) &&
    draft.cardSegments.length < CARD_SEGMENTS.length
      ? CARD_SEGMENTS.filter((segment) => draft.cardSegments.includes(segment))
      : null;
  if (matchSelectionApplies(draft, ctx) && draft.matches.mode !== 'ALL') {
    request.matchSelection = toRequest(draft.matches);
    if (cardSegments) request.matchSelection.cardSegments = cardSegments;
  } else if (
    matchSelectionApplies(draft, ctx) &&
    isFightNights(draft, ctx) &&
    (draft.eventSeries || cardSegments)
  ) {
    request.matchSelection = { mode: 'ALL' };
    if (draft.eventSeries) request.matchSelection.eventSeries = draft.eventSeries;
    if (cardSegments) request.matchSelection.cardSegments = cardSegments;
  }
  const women =
    competition?.tennis && draft.tennisDraw === 'BOTH'
      ? tennisCompetition(ctx, competition.tennis.tournamentId, 'WOMEN')
      : undefined;
  if (competition && women) {
    request.matchSelection = { mode: 'ALL', competitionIds: [competition.id, women.id] };
  }
  const scoring = customScoringRules(draft);
  if (scoring) request.scoring = scoring;
  if (draft.lockMode) {
    request.lockMode = draft.lockMode;
    if (draft.lockMode === 'FIXED_DATE') request.lockDate = draft.lockDate;
    else request.lockOffsetMinutes = lockOffsetMinutes(draft);
  }
  return request;
}

/** Identificador aleatorio para la cabecera `Idempotency-Key`. */
export function newCreationKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** La imagen guardada en el borrador, lista para subir. Sin `fetch`: la CSP no admite `data:`. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ''] = dataUrl.split(',');
  const type = /^data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

const STORAGE_KEY = 'createLeagueDraft';

/** Borrador guardado en el dispositivo; uno roto o de otra versión cuenta como vacío. */
export function readStoredDraft(): LeagueDraft {
  const base = emptyDraft();
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return base;
    const stored = parsed as Partial<Record<keyof LeagueDraft, unknown>>;
    const pick = <K extends keyof LeagueDraft>(key: K, valid: (value: unknown) => boolean) =>
      valid(stored[key]) ? (stored[key] as LeagueDraft[K]) : base[key];
    const isString = (value: unknown) => typeof value === 'string';
    const isBool = (value: unknown) => typeof value === 'boolean';
    const isIds = (value: unknown) =>
      Array.isArray(value) && value.every((item) => typeof item === 'number');
    const storedMatches = stored.matches as Partial<SelectionValue> | undefined;
    const matches: SelectionValue =
      storedMatches &&
      ['ALL', 'TEAMS', 'PICK'].includes(storedMatches.mode as PickMode) &&
      isIds(storedMatches.teamIds) &&
      isIds(storedMatches.included) &&
      isIds(storedMatches.excluded)
        ? {
            ...(storedMatches as SelectionValue),
            // Un borrador de antes de poder juntar competiciones: solo la principal.
            competitionIds: isIds(storedMatches.competitionIds)
              ? (storedMatches.competitionIds as number[])
              : [],
          }
        : base.matches;
    const scoring =
      stored.scoring && typeof stored.scoring === 'object'
        ? { ...base.scoring, ...(stored.scoring as ScoringDraft) }
        : base.scoring;
    return {
      sport: pick('sport', (value) =>
        [
          'FOOTBALL',
          'LEAGUE_OF_LEGENDS',
          'FORMULA_1',
          'BASKETBALL',
          'AMERICAN_FOOTBALL',
          'TENNIS',
          'MMA',
          'OTHER',
        ].includes(value as string),
      ),
      competitionId: pick('competitionId', (value) => typeof value === 'number'),
      custom: pick('custom', isBool),
      customName: pick('customName', isString),
      poolFormat: pick('poolFormat', (value) => POOL_FORMAT_ORDER.includes(value as PoolFormat)),
      lockMode: pick('lockMode', isString),
      lockAmount: pick('lockAmount', isString),
      lockUnit: pick(
        'lockUnit',
        (value) => value === 'minutes' || value === 'hours' || value === 'days',
      ),
      lockDate: pick('lockDate', isString),
      customScoring: pick('customScoring', isBool),
      scoring,
      pichichi: pick('pichichi', isBool),
      matches,
      matchesCompetitionId: pick('matchesCompetitionId', (value) => typeof value === 'number'),
      tennisDraw: pick('tennisDraw', (value) => ['MEN', 'WOMEN', 'BOTH'].includes(value as string)),
      eventSeries: pick('eventSeries', (value) =>
        ['NUMBERED', 'FIGHT_NIGHT'].includes(value as string),
      ),
      cardSegments: pick(
        'cardSegments',
        (value) =>
          Array.isArray(value) &&
          value.every((item) => CARD_SEGMENTS.includes(item as CardSegment)),
      ),
      entryFee: pick('entryFee', isBool),
      name: pick('name', isString),
      rules: pick('rules', isString),
      image: pick('image', (value) => typeof value === 'string' && value.startsWith('data:image/')),
      creationKey: pick('creationKey', isString),
    };
  } catch {
    return base;
  }
}

export function storeDraft(draft: LeagueDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Sin espacio (una imagen grande): se guarda el resto y la imagen se vuelve a elegir.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, image: null }));
    } catch {
      /* sin almacenamiento: el borrador vive solo en memoria */
    }
  }
}

export function clearStoredDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
