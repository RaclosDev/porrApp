export type TopologyVersion = 1 | 2;

/** Missing versions belong to historical predictions and must retain their original branches. */
export const topologyVersion = (version?: TopologyVersion): TopologyVersion => version ?? 1;

// FIFA draw procedures, Appendix A: M74,77,73,75,83,84,81,82 / M76,78,79,80,86,88,85,87.
// https://digitalhub.fifa.com/m/2d1a1ac7bab78995/original/Draw-Procedures-for-the-FIFA-World-Cup-2026.pdf
const CANONICAL_FROM_LEGACY = [0, 1, 4, 2, 8, 9, 10, 11, 3, 5, 6, 7, 12, 13, 14, 15];

/**
 * El orden antiguo solo existió en el cuadro de 16 cruces del Mundial: cualquier otro tamaño está
 * siempre en el orden del cuadro.
 */
const reordered = (size: number, version?: TopologyVersion) =>
  size === CANONICAL_FROM_LEGACY.length && topologyVersion(version) === 2;

export const orderR32 = <T>(legacy: T[], version?: TopologyVersion): T[] =>
  reordered(legacy.length, version) ? CANONICAL_FROM_LEGACY.map((index) => legacy[index]) : legacy;

export const legacyR32Order = <T>(pairs: T[], version?: TopologyVersion): T[] =>
  reordered(pairs.length, version)
    ? CANONICAL_FROM_LEGACY.map((_, index) => pairs[CANONICAL_FROM_LEGACY.indexOf(index)])
    : pairs;

/** Posición en el cuadro del cruce que ocupaba `legacyIndex` en una primera ronda de `size` cruces. */
export const r32SlotIndex = (
  legacyIndex: number,
  version?: TopologyVersion,
  size: number = CANONICAL_FROM_LEGACY.length,
): number => (reordered(size, version) ? CANONICAL_FROM_LEGACY.indexOf(legacyIndex) : legacyIndex);
