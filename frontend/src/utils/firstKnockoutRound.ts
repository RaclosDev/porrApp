import type { TournamentFormat, TournamentRounds } from '../types/api';
import { legacyR32Order, type TopologyVersion } from './bracketTopology';

/**
 * Hueco de un cruce de la primera ronda eliminatoria, con la notación del servidor
 * (`TournamentFormat.firstKnockoutRound`): un puesto de grupo («1E», «2A») o el tercero de uno de
 * varios grupos («3ABCDF»).
 */
export type GroupSlot = string;

/** Cruces del Mundial 2026 en el orden del cuadro (anexo A del sorteo de la FIFA). */
export const WORLD_CUP_2026_FIRST_ROUND: GroupSlot[][] = [
  ['1E', '3ABCDF'],
  ['1I', '3CDFGH'],
  ['2A', '2B'],
  ['1F', '2C'],
  ['2K', '2L'],
  ['1H', '2J'],
  ['1D', '3BEFIJ'],
  ['1G', '3AEHIJ'],
  ['1C', '2F'],
  ['2E', '2I'],
  ['1A', '3CEFHI'],
  ['1L', '3EHIJK'],
  ['1J', '2H'],
  ['2D', '2G'],
  ['1B', '3EFGIJ'],
  ['1K', '3DEIJL'],
];

/**
 * Forma del Mundial 2026: la que tienen los cuadros guardados antes de que el servidor la dijera, y
 * la que se usa mientras llega la del torneo de la liga.
 */
export const WORLD_CUP_2026_FORMAT: TournamentFormat = {
  groups: 'ABCDEFGHIJKL'.split(''),
  bestThirds: 8,
  thirdPlaceMatch: true,
  firstRound: 'r32',
  firstKnockoutRound: WORLD_CUP_2026_FIRST_ROUND,
};

/** Rondas del cuadro antes de la final, con el nombre con el que se guardan. */
export const BRACKET_ROUNDS = ['r32', 'r16', 'qf', 'sf'] as const;
export type BracketRound = (typeof BRACKET_ROUNDS)[number];

const ROUND_LABELS: Record<BracketRound, string> = {
  r32: '16avos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semis',
};

/** Rondas que juega el torneo, desde la primera de su cuadro. */
export const roundsOf = (format: Pick<TournamentRounds, 'firstRound'>): BracketRound[] =>
  BRACKET_ROUNDS.slice(Math.max(0, BRACKET_ROUNDS.indexOf(format.firstRound)));

/** El torneo juega esa ronda: una que no es del cuadro (grupos, finales, total) la juegan todos. */
export const playsRound = (format: Pick<TournamentRounds, 'firstRound'>, round: string): boolean =>
  !BRACKET_ROUNDS.includes(round as BracketRound) ||
  roundsOf(format).includes(round as BracketRound);

/** Títulos de las rondas del torneo, para las columnas de su cuadro. */
export const roundLabelsOf = (format: TournamentFormat): string[] =>
  roundsOf(format).map((round) => ROUND_LABELS[round]);

/** El hueco es para un tercero de grupo: no se sabe de cuál hasta ordenar los terceros. */
export const isThirdSlot = (slot: GroupSlot) => slot.startsWith('3');

/** Puesto y grupo de un hueco de primero o segundo («1E» → primero del E). */
export const groupSpot = (slot: GroupSlot): { position: 'first' | 'second'; group: string } => ({
  position: slot.startsWith('1') ? 'first' : 'second',
  group: slot.slice(1),
});

/** Texto del hueco mientras no hay equipo: «1º Grupo E», «3º A/B/C/D/F». */
export const slotLabel = (slot: GroupSlot): string =>
  isThirdSlot(slot)
    ? `3º ${slot.slice(1).split('').join('/')}`
    : `${slot[0]}º Grupo ${slot.slice(1)}`;

/** Los cruces con sus textos de hueco, en el orden del cuadro. */
export const firstRoundLabels = (round: GroupSlot[][]): [string, string][] =>
  round.map(([home, away]) => [slotLabel(home), slotLabel(away)]);

/** Los cruces en el orden en que los guardaba la versión indicada del cuadro. */
export const firstRoundInLegacyOrder = (
  round: GroupSlot[][],
  version: TopologyVersion = 2,
): GroupSlot[][] => legacyR32Order(round, version);
