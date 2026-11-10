import type { Group } from '../types/api';

/**
 * Liga de juegos de mesa: no tiene competición ni predicciones. No puede ser la liga activa de una
 * porra; se abre en su propia pantalla.
 */
export const isScoreboardLeague = (league: Pick<Group, 'kind'> | null | undefined): boolean =>
  league?.kind === 'SCOREBOARD';

export const scoreboardPath = (leagueId: number | string): string => `/marcador/${leagueId}`;
