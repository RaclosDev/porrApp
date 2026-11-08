/** Textos de las peleas de la UFC: métodos, bloques de la cartelera, pesos y resultados. */
import type { CardSegment, FightInfo, FightMethod } from '../types/api';

export const FIGHT_METHOD_LABELS: Record<FightMethod, string> = {
  KO_TKO: 'KO/TKO',
  SUBMISSION: 'Sumisión',
  DECISION: 'Decisión',
};

export const SEGMENT_LABELS: Record<CardSegment, string> = {
  MAIN: 'Cartelera estelar',
  PRELIMS: 'Preliminares',
  EARLY_PRELIMS: 'Preliminares tempranos',
};

export const segmentLabel = (segment: FightInfo['segment']) =>
  (segment && SEGMENT_LABELS[segment]) || 'Preliminares';

/** Partes de la cartelera en el orden de la velada: de las primeras peleas a la estelar. */
export const CARD_SEGMENTS: readonly CardSegment[] = ['EARLY_PRELIMS', 'PRELIMS', 'MAIN'];

/** Nombre con que las anuncia la UFC, para reconocerlas. */
export const SEGMENT_UFC_NAMES: Record<CardSegment, string> = {
  EARLY_PRELIMS: 'Early Prelims',
  PRELIMS: 'Prelims',
  MAIN: 'Main Card',
};

/** Texto de las partes elegidas: «Toda la velada» con las tres. */
export const describeSegments = (segments: readonly CardSegment[]) =>
  segments.length === CARD_SEGMENTS.length
    ? 'Toda la velada'
    : CARD_SEGMENTS.filter((segment) => segments.includes(segment))
        .map((segment) => SEGMENT_LABELS[segment])
        .join(', ');

const WEIGHT_CLASSES: Record<string, string> = {
  strawweight: 'Peso paja',
  flyweight: 'Peso mosca',
  bantamweight: 'Peso gallo',
  featherweight: 'Peso pluma',
  lightweight: 'Peso ligero',
  welterweight: 'Peso wélter',
  middleweight: 'Peso medio',
  'light heavyweight': 'Peso semipesado',
  heavyweight: 'Peso pesado',
  catchweight: 'Peso pactado',
};

/** «Women's Flyweight» o «W Flyweight» → «Peso mosca femenino». Lo que no se reconoce queda igual. */
export function weightClassLabel(weightClass: string): string {
  const text = weightClass.trim();
  const women = /^(women'?s|w)\s+/i.test(text);
  const base = text.replace(/^(women'?s|w)\s+/i, '').toLowerCase();
  const label = WEIGHT_CLASSES[base];
  if (!label) return text;
  return women ? `${label} femenino` : label;
}

/** «Por el título», o «Por el título interino»; null si no hay título en juego. */
export function titleLabel(fight: Pick<FightInfo, 'title'> | null | undefined): string | null {
  const title = fight?.title?.trim();
  if (!title) return null;
  return /interim/i.test(title) ? 'Por el título interino' : 'Por el título';
}

/**
 * Cartel de la pelea en su velada: «Pelea estelar» la primera y «Coestelar» la segunda de la cartelera
 * estelar; null el resto.
 */
export function boutBilling(fight: Pick<FightInfo, 'order' | 'segment'> | null | undefined) {
  if (!fight) return null;
  if (fight.order === 1) return 'Pelea estelar';
  if (fight.order === 2 && fight.segment === 'MAIN') return 'Coestelar';
  return null;
}

/**
 * Tarjetas de los jueces de una decisión con la puntuación del ganador delante, como se leen siempre:
 * «30-27, 29-28, 30-27». ESPN las da desde la esquina roja. Null si no las hay.
 */
export function judgesScoresText(fight: FightInfo | null | undefined): string | null {
  if (!fight || (fight.resultMethod !== 'DECISION' && fight.resultMethod !== 'DRAW')) return null;
  const cards = (fight.judgesScores ?? '')
    .split('|')
    .map((card) => /^(\d{1,2})-(\d{1,2})$/.exec(card.trim()))
    .filter((card) => card !== null)
    .map(([, red, blue]) => (fight.winner === '2' ? `${blue}-${red}` : `${red}-${blue}`));
  return cards.length ? cards.join(', ') : null;
}

/** Insignia de cada luchador al acabar: W gana, L pierde, D empate y NC sin resultado. */
export type FightOutcome = 'W' | 'L' | 'D' | 'NC';

export const FIGHT_OUTCOME_LABELS: Record<FightOutcome, string> = {
  W: 'Victoria',
  L: 'Derrota',
  D: 'Empate',
  NC: 'Sin resultado',
};

/** Insignias de las dos esquinas de una pelea terminada; null si aún no ha acabado. */
export function fightOutcomes(
  fight: FightInfo | null | undefined,
  finished: boolean | null | undefined,
): { home: FightOutcome; away: FightOutcome } | null {
  if (!fight || !finished) return null;
  if (fight.winner === '1') return { home: 'W', away: 'L' };
  if (fight.winner === '2') return { home: 'L', away: 'W' };
  const neutral: FightOutcome = fight.resultMethod === 'DRAW' ? 'D' : 'NC';
  return { home: neutral, away: neutral };
}

const DECISION_KINDS: Record<string, string> = {
  unanimous: 'unánime',
  split: 'dividida',
  majority: 'mayoritaria',
};

const DRAW_KINDS: Record<string, string> = {
  unanimous: 'unánime',
  split: 'dividido',
  majority: 'mayoritario',
};

/** Golpes y llaves tal como los da ESPN («Rear Naked Choke», «Elbows»…). */
const TECHNIQUES: Record<string, string> = {
  punch: 'puñetazo',
  punches: 'puñetazos',
  elbow: 'codazo',
  elbows: 'codazos',
  kick: 'patada',
  kicks: 'patadas',
  'head kick': 'patada a la cabeza',
  'body kick': 'patada al cuerpo',
  'leg kick': 'patada a la pierna',
  'leg kicks': 'patadas a la pierna',
  knee: 'rodillazo',
  knees: 'rodillazos',
  'flying knee': 'rodillazo en salto',
  'spinning back elbow': 'codazo giratorio',
  'spinning back fist': 'puño giratorio',
  'spinning back kick': 'patada giratoria',
  'spinning wheel kick': 'patada giratoria',
  slam: 'proyección',
  injury: 'lesión',
  "doctor's stoppage": 'parada médica',
  'corner stoppage': 'abandono desde la esquina',
  retirement: 'abandono',
  'rear naked choke': 'mataleón',
  'guillotine choke': 'guillotina',
  guillotine: 'guillotina',
  armbar: 'palanca de brazo',
  'arm triangle': 'triángulo de brazo',
  'arm triangle choke': 'triángulo de brazo',
  'triangle choke': 'triángulo',
  'triangle armbar': 'triángulo con palanca de brazo',
  'triangle choke with armbar': 'triángulo con palanca de brazo',
  kimura: 'kimura',
  'anaconda choke': 'anaconda',
  "d'arce choke": "d'arce",
  'heel hook': 'gancho de talón',
  keylock: 'americana',
  americana: 'americana',
  'ezekiel choke': 'ezequiel',
  'neck crank': 'torsión de cuello',
  'north-south choke': 'estrangulación norte-sur',
  'von flue choke': 'von flue',
  kneebar: 'palanca de rodilla',
  'ankle lock': 'llave de tobillo',
  'peruvian necktie': 'corbata peruana',
};

const technique = (text: string) => TECHNIQUES[text.toLowerCase()] ?? text;

/**
 * Cómo acabó, en español: «KO/TKO (codazos)», «TKO (parada médica)», «Sumisión (mataleón)»,
 * «Decisión dividida», «Descalificación», «Empate», «Sin resultado». Null si aún no hay método.
 */
export function fightMethodText(fight: FightInfo | null | undefined): string | null {
  if (!fight) return null;
  const [head = '', ...rest] = (fight.resultDetail ?? '').split(' - ');
  const extra = rest.join(' - ').trim();
  const kind = extra.toLowerCase();
  switch (fight.resultMethod) {
    case 'KO_TKO': {
      const name = head.trim().toUpperCase();
      const label = name === 'KO' || name === 'TKO' ? name : 'KO/TKO';
      return extra ? `${label} (${technique(extra)})` : label;
    }
    case 'SUBMISSION':
      return extra ? `Sumisión (${technique(extra)})` : 'Sumisión';
    case 'DECISION':
      return DECISION_KINDS[kind] ? `Decisión ${DECISION_KINDS[kind]}` : 'Decisión';
    case 'DRAW':
      return DRAW_KINDS[kind] ? `Empate ${DRAW_KINDS[kind]}` : 'Empate';
    case 'NO_CONTEST':
      return 'Sin resultado';
    case 'DISQUALIFICATION':
      return 'Descalificación';
    case 'OTHER':
      return fight.resultDetail?.trim() || null;
    default:
      return null;
  }
}

/** Método, asalto y tiempo del asalto: ['Sumisión (mataleón)', 'Asalto 2', '1:25']. */
export function fightResultParts(fight: FightInfo | null | undefined): string[] {
  if (!fight) return [];
  const parts: string[] = [];
  const method = fightMethodText(fight);
  if (method) parts.push(method);
  if (fight.resultRound) parts.push(`Asalto ${fight.resultRound}`);
  if (fight.resultClock) parts.push(fight.resultClock);
  return parts;
}

/** Cómo acabó, en una frase: «Gana Tom Nolan por KO/TKO (codazos) en el asalto 3, a 1:28». */
export function fightResultText(fixture: {
  homeTeam: string;
  awayTeam: string;
  fight?: FightInfo | null;
}): string {
  const fight = fixture.fight;
  if (!fight) return '';
  if (fight.resultMethod === 'DRAW') return 'Empate: no puntúa';
  if (fight.resultMethod === 'NO_CONTEST') return 'Sin resultado: no puntúa';
  const winner =
    fight.winner === '1' ? fixture.homeTeam : fight.winner === '2' ? fixture.awayTeam : null;
  if (!winner) return 'Sin ganador: no puntúa';
  const method = fightMethodText(fight);
  const parts = [`Gana ${winner}`];
  // «por sumisión», pero «por KO/TKO».
  if (method)
    parts.push(
      `por ${/^\p{Lu}\p{Ll}/u.test(method) ? method.charAt(0).toLocaleLowerCase('es') + method.slice(1) : method}`,
    );
  if (fight.resultRound) {
    parts.push(
      `en el asalto ${fight.resultRound}${fight.resultClock ? `, a ${fight.resultClock}` : ''}`,
    );
  }
  return parts.join(' ');
}

/** Método y asalto elegidos: «KO/TKO · asalto 3»; vacío si solo se eligió el ganador. */
export function methodRoundText(
  method: string | null | undefined,
  round: number | null | undefined,
): string {
  const parts: string[] = [];
  if (method && method in FIGHT_METHOD_LABELS) {
    parts.push(FIGHT_METHOD_LABELS[method as FightMethod]);
  }
  if (round) parts.push(`asalto ${round}`);
  return parts.join(' · ');
}
