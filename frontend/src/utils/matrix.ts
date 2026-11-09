import {
  WORLD_CUP_2026_FIRST_ROUND,
  firstRoundInLegacyOrder,
  isThirdSlot,
  type GroupSlot,
} from './firstKnockoutRound';

interface ThirdPlaceRule {
  side: 'left' | 'right';
  matchIndex: number;
  isHome: boolean;
  allowed: string[];
}

interface ThirdPlaceTeam {
  team: string;
  group: string;
}

/**
 * Huecos de los terceros en el orden antiguo del cuadro, con los grupos de los que puede venir cada
 * uno: salen de los cruces de la primera ronda («3ABCDF» admite a los terceros de A, B, C, D y F).
 */
export const thirdPlaceRules = (firstRound: GroupSlot[][]): ThirdPlaceRule[] => {
  const half = firstRound.length / 2;
  return firstRoundInLegacyOrder(firstRound).flatMap((slots, index) =>
    slots.flatMap((slot, position): ThirdPlaceRule[] =>
      isThirdSlot(slot)
        ? [
            {
              side: index < half ? 'left' : 'right',
              matchIndex: index % half,
              isHome: position === 0,
              allowed: slot.slice(1).split(''),
            },
          ]
        : [],
    ),
  );
};

const DEFAULT_THIRD_PLACE_RULES = thirdPlaceRules(WORLD_CUP_2026_FIRST_ROUND);

/**
 * Asigna los mejores terceros a sus huecos (backtracking); null si no hay combinación válida o no
 * hay tantos terceros como huecos.
 */
export function solveThirdPlaceMatrix(
  thirdTeams: ThirdPlaceTeam[] | null | undefined,
  rules: ThirdPlaceRule[] = DEFAULT_THIRD_PLACE_RULES,
): ThirdPlaceTeam[] | null {
  const size = rules.length;
  if (!thirdTeams || thirdTeams.length !== size) return null;
  const teams = thirdTeams;

  const result: (ThirdPlaceTeam | null)[] = Array(size).fill(null);
  const used = Array(size).fill(false);

  function backtrack(slotIndex: number): boolean {
    if (slotIndex === size) return true;

    const allowedForSlot = rules[slotIndex].allowed;

    for (let i = 0; i < size; i++) {
      if (!used[i] && allowedForSlot.includes(teams[i].group)) {
        used[i] = true;
        result[slotIndex] = teams[i];
        if (backtrack(slotIndex + 1)) return true;
        used[i] = false;
        result[slotIndex] = null;
      }
    }
    return false;
  }

  if (backtrack(0)) {
    return result as ThirdPlaceTeam[];
  }
  return null;
}
