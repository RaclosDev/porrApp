export type TopologyVersion = 1 | 2;

/** Missing versions belong to historical predictions and must retain their original branches. */
export const topologyVersion = (version?: TopologyVersion): TopologyVersion => version ?? 1;

// FIFA draw procedures, Appendix A: M74,77,73,75,83,84,81,82 / M76,78,79,80,86,88,85,87.
// https://digitalhub.fifa.com/m/2d1a1ac7bab78995/original/Draw-Procedures-for-the-FIFA-World-Cup-2026.pdf
const CANONICAL_FROM_LEGACY = [0, 1, 4, 2, 8, 9, 10, 11, 3, 5, 6, 7, 12, 13, 14, 15];

export const orderR32 = <T>(legacy: T[], version?: TopologyVersion): T[] =>
  topologyVersion(version) === 2 ? CANONICAL_FROM_LEGACY.map((index) => legacy[index]) : legacy;

export const legacyR32Order = <T>(pairs: T[], version?: TopologyVersion): T[] =>
  topologyVersion(version) === 2
    ? CANONICAL_FROM_LEGACY.map((_, index) => pairs[CANONICAL_FROM_LEGACY.indexOf(index)])
    : pairs;

export const r32SlotIndex = (legacyIndex: number, version?: TopologyVersion): number =>
  topologyVersion(version) === 2 ? CANONICAL_FROM_LEGACY.indexOf(legacyIndex) : legacyIndex;
