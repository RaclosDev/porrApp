import type { CreateGroupRequest, CustomLockMode } from '../../services/api';
import type { Competition, PoolFormat, Sport } from '../../types/api';
import {
  DEFAULT_SCORING_RULES,
  SCORING_MAX_POINTS,
  draftToRules,
  sameRules,
  toDraft,
  type ScoringDraft,
} from '../../utils/scoringRules';
import { isMatchBasedFormat } from '../../utils/poolFormat';
import {
  BRACKET_LOCK_MODES,
  DRAWN_KNOCKOUT_LOCK_MODES,
  FIGHT_NIGHT_LOCK_MODES,
  LOCK_UNIT_MINUTES,
  matchdayLockModes,
  MAX_LOCK_OFFSET_MINUTES,
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
      : 'FOOTBALL');

/** Deportes con competiciones oficiales, en el orden en que llegan, y «otro» al final. */
export function sportChoices(ctx: DraftContext): SportChoice[] {
  const sports = [...new Set(ctx.competitions.map(competitionSport))];
  return [...sports, 'OTHER'];
}

/** Por qué no se puede crear una liga sobre esta competición, o null si se puede. */
export const competitionUnavailableReason = (competition: Competition) =>
  competition.finished ? 'Ya ha terminado: no quedan partidos por jugar.' : null;

export const competitionsOfSport = (ctx: DraftContext, sport: SportChoice | null) =>
  ctx.competitions.filter((item) => competitionSport(item) === sport);

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
  scoring: toDraft(DEFAULT_SCORING_RULES),
  pichichi: false,
  matches: ALL_MATCHES,
  matchesCompetitionId: null,
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

export const POOL_FORMAT_ORDER: PoolFormat[] = [
  'MATCH_DAY',
  'SURVIVOR',
  'FULL_BRACKET',
  'KNOCKOUTS_ONLY',
];

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

/** Las eliminatorias de la competición elegida se sortean ronda a ronda. */
export const isKnockoutDraw = (draft: LeagueDraft, ctx: DraftContext) =>
  Boolean(selectedCompetition(draft, ctx)?.knockoutDraw);

/** Cómo se juega un formato con la competición elegida. */
export function formatCopy(format: PoolFormat, draft: LeagueDraft, ctx: DraftContext) {
  if (format === 'MATCH_DAY' && isFightNights(draft, ctx)) return FIGHT_NIGHTS_COPY;
  return format === 'KNOCKOUTS_ONLY' && isKnockoutDraw(draft, ctx)
    ? KNOCKOUT_DRAW_COPY
    : FORMAT_COPY[format];
}

/** Por qué un formato no se puede elegir con esta competición, o null si se puede. */
export function formatUnavailableReason(
  format: PoolFormat,
  draft: LeagueDraft,
  ctx: DraftContext,
): string | null {
  if (format === 'SURVIVOR' && draft.custom) {
    // Sin resultados automáticos no se sabría quién cae.
    return 'Necesita una competición oficial: los resultados llegan solos y así se sabe quién cae.';
  }
  const competition = selectedCompetition(draft, ctx);
  if (competition?.formatType === 'EVENTS' && format !== 'MATCH_DAY') {
    return 'La UFC se juega velada a velada: elige Por veladas.';
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

/** Torneo oficial con cuadro propio (no el Mundial) o competición personalizada: se cierra cruce a cruce. */
const allowsProgressiveLock = (draft: LeagueDraft, ctx: DraftContext) => {
  if (draft.custom) return true;
  const competition = selectedCompetition(draft, ctx);
  return competition?.formatType === 'TOURNAMENT' && competition.externalId !== 'fifa.world';
};

/** Cierres que admite el formato elegido. Superviviente se pronostica partido a partido: como jornadas. */
export function lockModesFor(draft: LeagueDraft, ctx: DraftContext): LockModeOption[] {
  if (draft.poolFormat == null) return [];
  if (draft.poolFormat === 'MATCH_DAY' && isFightNights(draft, ctx)) return FIGHT_NIGHT_LOCK_MODES;
  if (isMatchBasedFormat(draft.poolFormat))
    return matchdayLockModes(isMultiCompetition(draft.matches));
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
  if (isMatchBasedFormat(draft.poolFormat)) return 'PER_MATCH';
  return modes.some((item) => item.value === 'PER_ROUND') ? 'PER_ROUND' : 'FIRST_MATCH';
}

/**
 * El pichichi solo se pronostica en el cuadro de un torneo oficial de fútbol con cuadro fijo (el
 * Mundial): en unas eliminatorias sorteadas ronda a ronda no se puntúa.
 */
export const pichichiApplies = (draft: LeagueDraft, ctx: DraftContext) =>
  !draft.custom &&
  !isKnockoutDraw(draft, ctx) &&
  draft.sport === 'FOOTBALL' &&
  selectedCompetition(draft, ctx)?.formatType === 'TOURNAMENT' &&
  draft.poolFormat != null &&
  !isMatchBasedFormat(draft.poolFormat);

/** Elegir partidos: solo en una liga por jornadas sobre una competición oficial. */
export const matchSelectionApplies = (draft: LeagueDraft, ctx: DraftContext) =>
  !draft.custom && draft.poolFormat === 'MATCH_DAY' && selectedCompetition(draft, ctx) != null;

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
  if (next.poolFormat && formatUnavailableReason(next.poolFormat, next, ctx))
    next.poolFormat = null;
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
  if (!scoringEditable(next)) next.customScoring = false;
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
  return rules && !sameRules(rules, DEFAULT_SCORING_RULES) ? rules : undefined;
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
  if (matchSelectionApplies(draft, ctx) && draft.matches.mode !== 'ALL') {
    request.matchSelection = toRequest(draft.matches);
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
        ['FOOTBALL', 'LEAGUE_OF_LEGENDS', 'MMA', 'OTHER'].includes(value as string),
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
