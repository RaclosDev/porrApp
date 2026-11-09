import { legacyR32Order, type TopologyVersion } from './bracketTopology';

/**
 * Hueco de un cruce de la primera ronda eliminatoria, con la notación del servidor
 * (`TournamentFormat.firstKnockoutRound`): un puesto de grupo («1E», «2A») o el tercero de uno de
 * varios grupos («3ABCDF»).
 */
export type GroupSlot = string;

/** Cruces del Mundial 2026 en el orden del cuadro (anexo A del sorteo de la FIFA). */
export const WORLD_CUP_2026_FIRST_ROUND: [GroupSlot, GroupSlot][] = [
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
export const firstRoundLabels = (round: [GroupSlot, GroupSlot][]): [string, string][] =>
  round.map(([home, away]) => [slotLabel(home), slotLabel(away)]);

/** Los cruces en el orden en que los guardaba la versión indicada del cuadro. */
export const firstRoundInLegacyOrder = (
  round: [GroupSlot, GroupSlot][],
  version: TopologyVersion = 2,
): [GroupSlot, GroupSlot][] => legacyR32Order(round, version);
