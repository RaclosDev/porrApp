/** Textos de las peleas de la UFC: métodos, bloques de la cartelera, pesos y resultados. */
import type { FightInfo, FightMethod, MatchdayFixture } from '../types/api';

export const FIGHT_METHOD_LABELS: Record<FightMethod, string> = {
  KO_TKO: 'KO/TKO',
  SUBMISSION: 'Sumisión',
  DECISION: 'Decisión',
};

const SEGMENT_LABELS: Record<string, string> = {
  MAIN: 'Cartelera estelar',
  PRELIMS: 'Preliminares',
  EARLY_PRELIMS: 'Preliminares tempranos',
};

export const segmentLabel = (segment: FightInfo['segment']) =>
  (segment && SEGMENT_LABELS[segment]) || 'Preliminares';

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

/** Cómo acabó: «Gana Tom Nolan por KO/TKO (Elbows) en el asalto 3 (1:28)». */
export function fightResultText(fixture: MatchdayFixture): string {
  const fight = fixture.fight;
  if (!fight) return '';
  if (fight.resultMethod === 'DRAW') return 'Empate: no puntúa';
  if (fight.resultMethod === 'NO_CONTEST') return 'Sin resultado: no puntúa';
  const winner =
    fight.winner === '1' ? fixture.homeTeam : fight.winner === '2' ? fixture.awayTeam : null;
  if (!winner) return 'Sin ganador: no puntúa';
  const method =
    fight.resultMethod === 'KO_TKO' ||
    fight.resultMethod === 'SUBMISSION' ||
    fight.resultMethod === 'DECISION'
      ? FIGHT_METHOD_LABELS[fight.resultMethod]
      : fight.resultMethod === 'DISQUALIFICATION'
        ? 'descalificación'
        : null;
  const detail = fight.resultDetail?.split(' - ').slice(1).join(' - ');
  const parts = [`Gana ${winner}`];
  if (method) parts.push(`por ${method}${detail ? ` (${detail})` : ''}`);
  if (fight.resultRound) {
    parts.push(
      `en el asalto ${fight.resultRound}${fight.resultClock ? ` (${fight.resultClock})` : ''}`,
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
