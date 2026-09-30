export const THIRD_PLACE_RULES = [
  { side: 'left',  matchIndex: 0, isHome: false, allowed: ['A', 'B', 'C', 'D', 'F'] }, // M74: 1E vs 3º
  { side: 'left',  matchIndex: 1, isHome: false, allowed: ['C', 'D', 'F', 'G', 'H'] }, // M77: 1I vs 3º
  { side: 'left',  matchIndex: 6, isHome: false, allowed: ['C', 'E', 'F', 'H', 'I'] }, // M79: 1A vs 3º
  { side: 'left',  matchIndex: 7, isHome: false, allowed: ['E', 'H', 'I', 'J', 'K'] }, // M80: 1L vs 3º
  { side: 'right', matchIndex: 2, isHome: false, allowed: ['B', 'E', 'F', 'I', 'J'] }, // M81: 1D vs 3º
  { side: 'right', matchIndex: 3, isHome: false, allowed: ['A', 'E', 'H', 'I', 'J'] }, // M82: 1G vs 3º
  { side: 'right', matchIndex: 6, isHome: false, allowed: ['E', 'F', 'G', 'I', 'J'] }, // M85: 1B vs 3º
  { side: 'right', matchIndex: 7, isHome: false, allowed: ['D', 'E', 'I', 'J', 'L'] }  // M87: 1K vs 3º
];

/**
 * Finds a valid matching of 8 third-placed teams to the 8 slots using bipartite matching (backtracking).
 * @param {Array<{team: string, group: string}>} thirdTeams - Array of the 8 advancing third-placed teams.
 * @returns {Array<{team: string, group: string}> | null} - Array of 8 teams matched to the 8 slots in THIRD_PLACE_RULES order, or null if no matching exists.
 */
export function solveThirdPlaceMatrix(thirdTeams) {
  if (!thirdTeams || thirdTeams.length !== 8) return null;

  const result = Array(8).fill(null);
  const used = Array(8).fill(false);

  function backtrack(slotIndex) {
    if (slotIndex === 8) return true; // Found a valid assignment

    const allowedForSlot = THIRD_PLACE_RULES[slotIndex].allowed;

    for (let i = 0; i < 8; i++) {
      if (!used[i] && allowedForSlot.includes(thirdTeams[i].group)) {
        used[i] = true;
        result[slotIndex] = thirdTeams[i];
        if (backtrack(slotIndex + 1)) return true;
        used[i] = false;
        result[slotIndex] = null;
      }
    }
    return false;
  }

  if (backtrack(0)) {
    return result;
  }
  return null; // Fallback
}
