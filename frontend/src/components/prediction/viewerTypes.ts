import type { ReactNode } from 'react';
import type { GroupSelection } from '../../utils/bracketDraft';
import type { RoundRef, usePredictionViewerData } from '../../hooks/usePredictionViewerData';

export type ViewerTab = 'groups' | 'thirds' | 'bracket';

export type ViewerData = ReturnType<typeof usePredictionViewerData>;

export type RenderViewerSlot = (
  name: string | null | undefined,
  ctx: { roundIndex: RoundRef; isHome?: boolean },
) => ReactNode;

/** Equipo de una posición del grupo, guardado como lista o como posiciones con nombre. */
export const getTeamVal = (
  groupVal: GroupSelection | string[] | undefined,
  idx: number,
  key: keyof GroupSelection,
): string | null => {
  if (!groupVal) return null;
  if (Array.isArray(groupVal)) return groupVal[idx] || null;
  if (typeof groupVal === 'object') return groupVal[key] || null;
  return null;
};
