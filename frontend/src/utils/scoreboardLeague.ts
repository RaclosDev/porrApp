import type { Group } from '../types/api';

/**
 * Liga de juegos de mesa: no tiene competición ni predicciones. Puede ser la liga activa, y entonces
 * su inicio es el marcador (ver `leagueKindOf`).
 */
export const isScoreboardLeague = (league: Pick<Group, 'kind'> | null | undefined): boolean =>
  league?.kind === 'SCOREBOARD';

/** Abre la liga como activa: el inicio la elige con `?group=` y enseña su marcador. */
export const scoreboardPath = (leagueId: number | string): string => `/?group=${leagueId}`;
