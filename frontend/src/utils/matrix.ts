import {
  WORLD_CUP_2026_FIRST_ROUND,
  firstRoundInLegacyOrder,
  isThirdSlot,
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
export const THIRD_PLACE_RULES: ThirdPlaceRule[] = firstRoundInLegacyOrder(
  WORLD_CUP_2026_FIRST_ROUND,
).flatMap((slots, index) =>
  slots.flatMap((slot, position): ThirdPlaceRule[] =>
    isThirdSlot(slot)
      ? [
          {
            side: index < 8 ? 'left' : 'right',
            matchIndex: index % 8,
            isHome: position === 0,
            allowed: slot.slice(1).split(''),
          },
        ]
      : [],
  ),
);

/** Asigna los 8 mejores terceros a sus huecos (backtracking); null si no hay combinación válida. */
export function solveThirdPlaceMatrix(
  thirdTeams: ThirdPlaceTeam[] | null | undefined,
): ThirdPlaceTeam[] | null {
  if (!thirdTeams || thirdTeams.length !== 8) return null;
  const teams = thirdTeams;

  const result: (ThirdPlaceTeam | null)[] = Array(8).fill(null);
  const used = Array(8).fill(false);

  function backtrack(slotIndex: number): boolean {
    if (slotIndex === 8) return true;

    const allowedForSlot = THIRD_PLACE_RULES[slotIndex].allowed;

    for (let i = 0; i < 8; i++) {
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
