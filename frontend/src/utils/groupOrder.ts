import { readGroupVisits } from '../store/useAppStore';
import type { Group } from '../types/api';

/**
 * Ligas ordenadas para listarlas: la activa primero, después las abiertas más recientemente en
 * este dispositivo y, al final, las nunca abiertas de la más nueva a la más antigua.
 */
export function sortGroupsByRecent(groups: Group[], activeGroupId: string | number | null) {
  const visits = readGroupVisits();
  return [...groups].sort((a, b) => {
    const aSelected = String(a.id) === String(activeGroupId);
    const bSelected = String(b.id) === String(activeGroupId);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;

    const aVisited = Number(visits[a.id]) || 0;
    const bVisited = Number(visits[b.id]) || 0;
    if (aVisited !== bVisited) return bVisited - aVisited;

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}
