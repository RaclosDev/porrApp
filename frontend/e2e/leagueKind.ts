import { leagueKindOf, type LeagueFacts, type LeagueKind } from '../src/context/leagueKind';

/**
 * Declara la clase de liga de un mock y comprueba que la app la clasifica igual: un mock que deja de
 * ser de su clase (le falta la competición, cambia el formato…) falla aquí y no en mitad del test.
 */
export function withLeagueKind<T extends LeagueFacts>(kind: LeagueKind, league: T): T {
  const actual = leagueKindOf({ hasLeague: true, loading: false, error: false, league });
  if (actual !== kind) throw new Error(`El mock es una liga ${actual}, no ${kind}`);
  return league;
}
