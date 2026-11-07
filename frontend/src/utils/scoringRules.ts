import type { PoolFormat, ScoringRuleKey, ScoringRules } from '../types/api';

interface ScoringField {
  key: ScoringRuleKey;
  label: string;
  hint: string;
  /** Puntos (por defecto), una cantidad (vidas) o un sí/no guardado como 1/0. */
  kind?: 'points' | 'count' | 'toggle';
}

interface ScoringSection {
  id: string;
  title: string;
  fields: ScoringField[];
}

const MATCHDAY: ScoringSection = {
  id: 'matches',
  title: 'Cada partido',
  fields: [
    {
      key: 'exactScorePoints',
      label: 'Resultado exacto',
      hint: 'Aciertas el marcador. No se suma al signo.',
    },
    {
      key: 'correctSignPoints',
      label: 'Signo 1X2',
      hint: 'Aciertas quién gana o que hay empate.',
    },
    {
      key: 'goalDiffBonusPoints',
      label: 'Bonus por diferencia de goles',
      hint: 'Se suma al signo si aciertas la diferencia en una victoria (2-0 y acaba 3-1).',
    },
  ],
};

const GROUPS: ScoringSection = {
  id: 'groups',
  title: 'Fase de grupos',
  fields: [
    {
      key: 'groupQualifierPoints',
      label: 'Pasa de grupo',
      hint: 'Por cada equipo de tu cuadro que se clasifica (1.º, 2.º o mejor tercero elegido).',
    },
    {
      key: 'groupExactPositionPoints',
      label: 'Posición exacta',
      hint: 'Se suma si además aciertas su puesto en el grupo.',
    },
  ],
};

const KNOCKOUTS: ScoringSection = {
  id: 'knockouts',
  title: 'Eliminatorias, por equipo acertado',
  fields: [
    { key: 'roundOf32Points', label: 'Dieciseisavos', hint: 'Cada equipo que pasa a octavos.' },
    { key: 'roundOf16Points', label: 'Octavos', hint: 'Cada equipo que pasa a cuartos.' },
    { key: 'quarterFinalPoints', label: 'Cuartos', hint: 'Cada equipo que pasa a semifinales.' },
    { key: 'semiFinalPoints', label: 'Semifinales', hint: 'Cada equipo que llega a la final.' },
  ],
};

const PODIUM: ScoringSection = {
  id: 'podium',
  title: 'Podio',
  fields: [
    { key: 'championPoints', label: 'Campeón', hint: 'Aciertas quién gana la final.' },
    { key: 'runnerUpPoints', label: 'Subcampeón', hint: 'Aciertas quién pierde la final.' },
    {
      key: 'thirdPlacePoints',
      label: 'Tercer puesto',
      hint: 'Aciertas quién gana el partido por el tercer puesto.',
    },
    { key: 'fourthPlacePoints', label: 'Cuarto puesto', hint: 'Aciertas quién lo pierde.' },
  ],
};

const TOP_SCORER: ScoringSection = {
  id: 'scorer',
  title: 'Pichichi',
  fields: [
    {
      key: 'topScorerPoints',
      label: 'Máximo goleador',
      hint: 'Si hay empate en cabeza, se reparten entre los empatados.',
    },
  ],
};

const SURVIVOR: ScoringSection = {
  id: 'survivor',
  title: 'Superviviente',
  fields: [
    {
      key: 'survivorRoundPoints',
      label: 'Jornada superada',
      hint: 'Puntos por cada jornada en que tu equipo gana.',
    },
    {
      key: 'survivorLives',
      label: 'Vidas',
      hint: 'Fallos que aguanta cada uno antes de quedar eliminado. Con 1, el primero elimina.',
      kind: 'count',
    },
    {
      key: 'survivorDrawSurvives',
      label: 'El empate salva',
      hint: 'Si tu equipo empata, sigues vivo y la jornada cuenta como superada.',
      kind: 'toggle',
    },
  ],
};

/** Límites de las reglas que no son puntos: vidas de 1 a 10 y el empate como 0 o 1. */
const RANGES: Partial<Record<ScoringRuleKey, [number, number]>> = {
  survivorLives: [1, 10],
  survivorDrawSurvives: [0, 1],
};

/**
 * Reglas que cuentan en cada formato. Las porras de solo eliminatorias no pronostican los
 * grupos, así que sus reglas de grupo no se muestran.
 */
export function scoringSections(format: PoolFormat | null, pichichi: boolean): ScoringSection[] {
  if (format === 'MATCH_DAY') return [MATCHDAY];
  if (format === 'SURVIVOR') return [SURVIVOR];
  const sections = format === 'KNOCKOUTS_ONLY' ? [KNOCKOUTS, PODIUM] : [GROUPS, KNOCKOUTS, PODIUM];
  return pichichi ? [...sections, TOP_SCORER] : sections;
}

/**
 * Puntuación con la que nace una liga y máximo por regla: los mismos valores que
 * `ScoringRuleSet` en el servidor. Sirven para configurarla antes de que la liga exista.
 */
export const DEFAULT_SCORING_RULES: ScoringRules = {
  groupQualifierPoints: 10,
  groupExactPositionPoints: 10,
  roundOf32Points: 25,
  roundOf16Points: 30,
  quarterFinalPoints: 40,
  semiFinalPoints: 60,
  championPoints: 200,
  runnerUpPoints: 150,
  thirdPlacePoints: 100,
  fourthPlacePoints: 75,
  topScorerPoints: 200,
  exactScorePoints: 5,
  correctSignPoints: 3,
  goalDiffBonusPoints: 1,
  survivorRoundPoints: 1,
  survivorLives: 1,
  survivorDrawSurvives: 0,
};
export const SCORING_MAX_POINTS = 1000;

/** Valores tal como se escriben en los campos del formulario. */
export type ScoringDraft = Record<ScoringRuleKey, string>;

export const toDraft = (rules: ScoringRules): ScoringDraft =>
  Object.fromEntries(
    Object.entries(rules).map(([key, value]) => [key, String(value)]),
  ) as ScoringDraft;

/** Mensaje de error de un campo, o null si es un entero entre 0 y `max`. */
export function scoringValueError(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return 'Escribe un número entero, 0 o más.';
  if (Number(trimmed) > max) return `Como máximo ${max}.`;
  return null;
}

/** Error de una regla concreta: los puntos van de 0 a `max`; las vidas y el empate, en su rango. */
export function scoringFieldError(key: ScoringRuleKey, value: string, max: number): string | null {
  const range = RANGES[key];
  if (!range) return scoringValueError(value, max);
  const trimmed = value.trim();
  const [min, top] = range;
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < min || Number(trimmed) > top) {
    return `Entre ${min} y ${top}.`;
  }
  return null;
}

/** Reglas del borrador, o null si algún campo no es válido. */
export function draftToRules(draft: ScoringDraft, max: number): ScoringRules | null {
  const entries = Object.entries(draft);
  if (entries.some(([key, value]) => scoringFieldError(key as ScoringRuleKey, value, max)))
    return null;
  return Object.fromEntries(
    entries.map(([key, value]) => [key, Number(value.trim())]),
  ) as unknown as ScoringRules;
}

export const sameRules = (a: ScoringRules, b: ScoringRules) =>
  (Object.keys(a) as ScoringRuleKey[]).every((key) => a[key] === b[key]);
