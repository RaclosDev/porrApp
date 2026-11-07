import type { CreateGroupRequest, CustomLockMode } from '../../services/api';
import type { Competition, PoolFormat } from '../../types/api';
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
  LOCK_UNIT_MINUTES,
  MATCHDAY_LOCK_MODES,
  MAX_LOCK_OFFSET_MINUTES,
  SINGLE_LOCK_MODES,
  type LockModeOption,
  type LockUnit,
} from '../groups/custom/lockModes';

export const LEAGUE_STEPS = [
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

/** Lo que lleva elegido quien crea la liga. Se guarda tal cual en el dispositivo. */
export interface LeagueDraft {
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
  entryFee: boolean;
  name: string;
  rules: string;
  /** Imagen ya recortada, como data URL; se sube al crear la liga. */
  image: string | null;
  /** Clave de idempotencia del envío en curso: un reintento devuelve la misma liga. */
  creationKey: string | null;
}

export const emptyDraft = (): LeagueDraft => ({
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
export const FORMAT_COPY: Record<PoolFormat, { title: string; text: string }> = {
  MATCH_DAY: {
    title: 'Por jornadas',
    text: 'En cada jornada predices quién gana cada partido: 1, X o 2. Cada acierto suma y gana quien más puntos lleve al final.',
  },
  SURVIVOR: {
    title: 'Superviviente',
    text: 'En cada jornada eliges un equipo que gane, sin repetir equipo. Si empata o pierde, o si no eliges, quedas fuera. Gana quien aguante más jornadas.',
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
  if (!isMatchBasedFormat(format) && competition?.formatType === 'LEAGUE') {
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

/** Cierres que admite el formato elegido; vacío en superviviente, que cierra cada partido. */
export function lockModesFor(draft: LeagueDraft, ctx: DraftContext): LockModeOption[] {
  if (draft.poolFormat === 'MATCH_DAY') return MATCHDAY_LOCK_MODES;
  if (draft.poolFormat === 'SURVIVOR' || draft.poolFormat == null) return [];
  return allowsProgressiveLock(draft, ctx) ? BRACKET_LOCK_MODES : SINGLE_LOCK_MODES;
}

/**
 * Cierre propuesto. En un cuadro con rondas, por rondas: nunca falla aunque la competición ya haya
 * empezado. Sin rondas, al empezar el primer partido.
 */
function defaultLockMode(draft: LeagueDraft, ctx: DraftContext): CustomLockMode | null {
  const modes = lockModesFor(draft, ctx);
  if (modes.length === 0) return null;
  if (draft.poolFormat === 'MATCH_DAY') return 'PER_MATCH';
  return modes.some((item) => item.value === 'PER_ROUND') ? 'PER_ROUND' : 'FIRST_MATCH';
}

/** El pichichi solo se pronostica en el cuadro de un torneo oficial. */
export const pichichiApplies = (draft: LeagueDraft, ctx: DraftContext) =>
  !draft.custom &&
  selectedCompetition(draft, ctx)?.formatType === 'TOURNAMENT' &&
  draft.poolFormat != null &&
  !isMatchBasedFormat(draft.poolFormat);

/** Superviviente no tiene puntos que ajustar: cada jornada superada vale una. */
export const scoringEditable = (draft: LeagueDraft) =>
  draft.poolFormat != null && draft.poolFormat !== 'SURVIVOR';

/**
 * Deja coherente lo que depende de elecciones anteriores: al cambiar de competición o de formato se
 * quitan el formato, el cierre o el pichichi que ya no aplican.
 */
export function normalizeDraft(draft: LeagueDraft, ctx: DraftContext): LeagueDraft {
  const next = { ...draft };
  if (next.custom) next.competitionId = null;
  if (next.poolFormat && formatUnavailableReason(next.poolFormat, next, ctx))
    next.poolFormat = null;
  const modes = lockModesFor(next, ctx);
  if (!modes.some((item) => item.value === next.lockMode))
    next.lockMode = defaultLockMode(next, ctx);
  if (!pichichiApplies(next, ctx)) next.pichichi = false;
  if (!scoringEditable(next)) next.customScoring = false;
  return next;
}

export const lockOffsetMinutes = (draft: LeagueDraft) =>
  Number(draft.lockAmount.trim()) * LOCK_UNIT_MINUTES[draft.lockUnit];

/** Errores del paso por campo; vacío si se puede seguir. */
export type StepErrors = Partial<
  Record<
    | 'competition'
    | 'customName'
    | 'poolFormat'
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
  competition: 'cl-field-competition',
  customName: 'cl-custom-name',
  poolFormat: 'cl-field-format',
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
  if (step === 'competition') {
    if (!hasCompetition(draft, ctx)) errors.competition = 'Elige una competición.';
    else if (draft.custom && !draft.customName.trim())
      errors.customName = 'Ponle nombre a tu competición.';
    else if (draft.custom && draft.customName.trim().length > CUSTOM_NAME_MAX)
      errors.customName = `Como máximo ${CUSTOM_NAME_MAX} caracteres.`;
  }
  if (step === 'format' && !draft.poolFormat) {
    errors.poolFormat = 'Elige cómo se juega la liga.';
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
    const scoring =
      stored.scoring && typeof stored.scoring === 'object'
        ? { ...base.scoring, ...(stored.scoring as ScoringDraft) }
        : base.scoring;
    return {
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
