/**
 * Claves de TanStack Query. Todas las consultas e invalidaciones las construyen aquí para que
 * una invalidación no apunte a una clave que no existe.
 *
 * Cada función sin argumentos devuelve el prefijo, que sirve para invalidar todas las
 * variantes (`queryKeys.leaderboard()` invalida el ranking de todas las ligas).
 */
type KeyPart = string | number | boolean | null;

/** Construye la clave quitando los argumentos finales que no se han pasado. */
const key = (name: string, ...parts: (KeyPart | undefined)[]): readonly KeyPart[] => {
  let end = parts.length;
  while (end > 0 && parts[end - 1] === undefined) end--;
  return [name, ...(parts.slice(0, end) as KeyPart[])];
};

type Id = string | number | null;

/** Los ids de liga y de pronóstico llegan como número o como texto; la clave usa siempre texto. */
const asText = (id: Id | undefined) => (typeof id === 'number' ? String(id) : id);

export const queryKeys = {
  myGroups: (isAuthenticated?: boolean) => key('myGroups', isAuthenticated),
  group: (groupId?: Id) => key('group', asText(groupId)),
  groupMembers: (groupId?: Id) => key('groupMembers', asText(groupId)),
  predictions: (groupId?: Id) => key('predictions', asText(groupId)),
  leaderboard: (groupId?: Id) => key('leaderboard', asText(groupId)),
  leaderboardMatchdays: (groupId?: Id) => key('leaderboardMatchdays', asText(groupId)),
  matchdayFixtures: (groupId?: Id, user?: Id) => key('matchdayFixtures', asText(groupId), user),
  matchFriendPredictions: (groupId?: Id, matchId?: Id) =>
    key('matchFriendPredictions', asText(groupId), matchId),
  matchdayStats: (groupId?: Id) => key('matchdayStats', asText(groupId)),
  standings: () => key('standings'),
  odds: () => key('odds'),
  topScorers: () => key('topScorers'),
  officialBracket: () => key('officialBracket'),
  predictionScore: (predictionId?: Id) => key('predictionScore', asText(predictionId)),
  matches: (competitionId?: Id) => key('matches', competitionId),
  radar: (competitionId?: Id) => key('radar', competitionId),
  competitionStandings: (competitionId?: Id) => key('competitionStandings', competitionId),
};
