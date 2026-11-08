import type { PoolFormat, ScoringRuleKey, ScoringRules, Sport } from '../types/api';

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

/** UFC: cada pelea suma por el ganador y, encima, por el método y el asalto. */
const FIGHTS: ScoringSection = {
  id: 'fights',
  title: 'Cada pelea',
  fields: [
    { key: 'fightWinnerPoints', label: 'Ganador', hint: 'Aciertas quién gana la pelea.' },
    {
      key: 'fightMethodPoints',
      label: 'Método',
      hint: 'Se suma al ganador si aciertas cómo acaba: KO/TKO, sumisión o decisión.',
    },
    {
      key: 'fightRoundPoints',
      label: 'Asalto',
      hint: 'Se suma si además aciertas el asalto de un KO/TKO o una sumisión.',
    },
  ],
};

/** NFL: se predice quién gana, sin marcador ni empate. */
const WINNER_MATCHDAY: ScoringSection = {
  id: 'matches',
  title: 'Cada partido',
  fields: [
    {
      key: 'correctSignPoints',
      label: 'Ganador acertado',
      hint: 'Aciertas quién gana el partido. Si acaba en empate, no suma nadie.',
    },
  ],
};

/** LoL: se predice quién gana cada serie y, al mejor de tres o de cinco, también su resultado. */
const LOL_MATCHDAY: ScoringSection = {
  id: 'matches',
  title: 'Cada serie',
  fields: [
    {
      key: 'correctSignPoints',
      label: 'Ganador acertado',
      hint: 'Aciertas quién gana la serie.',
    },
    {
      key: 'exactScorePoints',
      label: 'Resultado de la serie',
      hint: 'Aciertas además el resultado (3-1) de una serie al mejor de tres o de cinco. Vale esto en vez del ganador.',
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

/** Superviviente de la NFL: se juega por semanas. */
const SURVIVOR_WEEKS: ScoringSection = {
  ...SURVIVOR,
  fields: SURVIVOR.fields.map((field) =>
    field.key === 'survivorRoundPoints'
      ? {
          ...field,
          label: 'Semana superada',
          hint: 'Puntos por cada semana en que tu equipo gana.',
        }
      : field.key === 'survivorDrawSurvives'
        ? { ...field, hint: 'Si tu equipo empata, sigues vivo y la semana cuenta como superada.' }
        : field,
  ),
};

/** Superviviente sin empates (las series del LoL siempre las gana alguien): sin la regla del empate. */
const SURVIVOR_NO_DRAWS: ScoringSection = {
  ...SURVIVOR,
  fields: SURVIVOR.fields.filter((field) => field.key !== 'survivorDrawSurvives'),
};

const GRAND_PRIX: ScoringSection = {
  id: 'grandPrix',
  title: 'Cada Gran Premio',
  fields: [
    {
      key: 'f1ExactPositionPoints',
      label: 'Puesto exacto del podio',
      hint: 'Por cada piloto que aciertas en su puesto: 1.º, 2.º o 3.º.',
    },
    {
      key: 'f1PodiumPoints',
      label: 'En el podio, otro puesto',
      hint: 'Por cada piloto de tu podio que sube, pero en otro puesto.',
    },
    { key: 'f1PolePoints', label: 'Pole', hint: 'Aciertas quién sale primero.' },
    {
      key: 'f1FastestLapPoints',
      label: 'Vuelta rápida',
      hint: 'Aciertas quién hace la vuelta más rápida de la carrera.',
    },
  ],
};

/** Límites de las reglas que no son puntos: vidas de 1 a 10 y el empate como 0 o 1. */
const RANGES: Partial<Record<ScoringRuleKey, [number, number]>> = {
  survivorLives: [1, 10],
  survivorDrawSurvives: [0, 1],
};

const DRAWN_KNOCKOUTS: ScoringSection = {
  id: 'knockouts',
  title: 'Eliminatorias, por cruce acertado',
  fields: [
    {
      key: 'roundOf32Points',
      label: 'Playoff o dieciseisavos',
      hint: 'Cada cruce de la primera ronda en el que aciertas quién pasa.',
    },
    {
      key: 'roundOf16Points',
      label: 'Octavos',
      hint: 'Cada cruce de octavos en el que aciertas quién pasa.',
    },
    {
      key: 'quarterFinalPoints',
      label: 'Cuartos',
      hint: 'Cada cruce de cuartos en el que aciertas quién pasa.',
    },
    {
      key: 'semiFinalPoints',
      label: 'Semifinales',
      hint: 'Cada semifinal en la que aciertas quién pasa.',
    },
    { key: 'championPoints', label: 'Final', hint: 'Aciertas quién gana la final.' },
  ],
};

/** Tenis: cada partido acertado vale más cuanto más avanza el torneo, y los sets suman aparte. */
const TENNIS: ScoringSection = {
  id: 'tennis',
  title: 'Cada partido, por ganador acertado',
  fields: [
    {
      key: 'roundOf16Points',
      label: 'Octavos',
      hint: 'Aciertas quién gana un partido de octavos (o de la fase de grupos de las ATP Finals y las WTA Finals).',
    },
    {
      key: 'quarterFinalPoints',
      label: 'Cuartos',
      hint: 'Aciertas quién gana un partido de cuartos.',
    },
    { key: 'semiFinalPoints', label: 'Semifinales', hint: 'Aciertas quién gana una semifinal.' },
    { key: 'championPoints', label: 'Final', hint: 'Aciertas quién gana la final: el campeón.' },
    {
      key: 'exactScorePoints',
      label: 'Extra por los sets',
      hint: 'Se suma si además aciertas el resultado en sets (3-1). No cuenta tras una retirada o un W.O.',
    },
  ],
};

const NBA_SERIES: ScoringSection = {
  id: 'nba-series',
  title: 'Playoffs NBA, por serie acertada',
  fields: [
    {
      key: 'nbaPlayInPoints',
      label: 'Play-in',
      hint: 'Cada partido del play-in en el que aciertas quién gana.',
    },
    {
      key: 'nbaFirstRoundPoints',
      label: 'Primera ronda',
      hint: 'Cada serie de primera ronda en la que aciertas quién gana.',
    },
    {
      key: 'nbaConferenceSemifinalPoints',
      label: 'Semifinales de conferencia',
      hint: 'Cada serie en la que aciertas quién gana.',
    },
    {
      key: 'nbaConferenceFinalPoints',
      label: 'Finales de conferencia',
      hint: 'Cada serie en la que aciertas quién gana.',
    },
    { key: 'nbaFinalsPoints', label: 'Finales', hint: 'Aciertas el campeón.' },
  ],
};

const NBA_EXACT: ScoringSection = {
  id: 'nba-exact',
  title: 'Extra por acertar el resultado de la serie (4-0, 4-1…)',
  fields: [
    {
      key: 'nbaFirstRoundExactPoints',
      label: 'Primera ronda',
      hint: 'Se suma al ganador si aciertas en cuántos partidos.',
    },
    {
      key: 'nbaConferenceSemifinalExactPoints',
      label: 'Semifinales de conferencia',
      hint: 'Se suma al ganador si aciertas en cuántos partidos.',
    },
    {
      key: 'nbaConferenceFinalExactPoints',
      label: 'Finales de conferencia',
      hint: 'Se suma al ganador si aciertas en cuántos partidos.',
    },
    {
      key: 'nbaFinalsExactPoints',
      label: 'Finales',
      hint: 'Se suma al campeón si aciertas en cuántos partidos.',
    },
  ],
};

/**
 * Reglas que cuentan en cada formato. Las porras de solo eliminatorias no pronostican los
 * grupos, así que sus reglas de grupo no se muestran. En unas eliminatorias sorteadas ronda a ronda
 * (Champions, Copa del Rey) se puntúa cada cruce acertado, sin podio ni pichichi. En la NFL
 * (`winnerOnly`) cada partido puntúa solo el ganador.
 */
export function scoringSections(
  format: PoolFormat | null,
  pichichi: boolean,
  knockoutDraw = false,
  nbaSeries = false,
  winnerOnly = false,
  sport: Sport | null = null,
  fights = false,
): ScoringSection[] {
  if (sport === 'TENNIS') return [TENNIS];
  if (format === 'MATCH_DAY' && sport === 'LEAGUE_OF_LEGENDS') return [LOL_MATCHDAY];
  if (format === 'MATCH_DAY') return [fights ? FIGHTS : winnerOnly ? WINNER_MATCHDAY : MATCHDAY];
  if (format === 'SURVIVOR' && sport === 'LEAGUE_OF_LEGENDS') return [SURVIVOR_NO_DRAWS];
  if (format === 'SURVIVOR' && sport === 'AMERICAN_FOOTBALL') return [SURVIVOR_WEEKS];
  if (format === 'SURVIVOR') return [SURVIVOR];
  if (format === 'GRAND_PRIX') return [GRAND_PRIX];
  if (nbaSeries) return [NBA_SERIES, NBA_EXACT];
  if (knockoutDraw) return [DRAWN_KNOCKOUTS];
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
  fightWinnerPoints: 3,
  fightMethodPoints: 2,
  fightRoundPoints: 2,
  f1ExactPositionPoints: 10,
  f1PodiumPoints: 4,
  f1PolePoints: 5,
  f1FastestLapPoints: 3,
  nbaPlayInPoints: 5,
  nbaFirstRoundPoints: 10,
  nbaConferenceSemifinalPoints: 20,
  nbaConferenceFinalPoints: 30,
  nbaFinalsPoints: 50,
  nbaFirstRoundExactPoints: 5,
  nbaConferenceSemifinalExactPoints: 10,
  nbaConferenceFinalExactPoints: 15,
  nbaFinalsExactPoints: 25,
};
export const SCORING_MAX_POINTS = 1000;

/** Puntuación con la que nace una liga de tenis (`ScoringRuleSet.defaultTennis` en el servidor). */
const TENNIS_SCORING_RULES: ScoringRules = {
  ...DEFAULT_SCORING_RULES,
  roundOf16Points: 10,
  quarterFinalPoints: 15,
  semiFinalPoints: 20,
  championPoints: 30,
  exactScorePoints: 5,
};

/** Puntuación por defecto de una liga del deporte. */
export const defaultScoringRules = (sport: Sport | 'OTHER' | null): ScoringRules =>
  sport === 'TENNIS' ? TENNIS_SCORING_RULES : DEFAULT_SCORING_RULES;

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
