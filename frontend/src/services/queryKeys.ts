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
  competitions: () => key('competitions'),
  myGroups: (isAuthenticated?: boolean) => key('myGroups', isAuthenticated),
  /** Cuelga de `myGroups`: invalidar las ligas también refresca el resumen. */
  myLeagueSummaries: () => key('myGroups', 'summary'),
  group: (groupId?: Id) => key('group', asText(groupId)),
  featuredGroup: () => key('featuredGroup'),
  recentPushNotifications: () => key('recentPushNotifications'),
  groupMembers: (groupId?: Id) => key('groupMembers', asText(groupId)),
  leagueScoring: (groupId?: Id) => key('leagueScoring', asText(groupId)),
  predictions: (groupId?: Id) => key('predictions', asText(groupId)),
  myPredictions: () => key('myPredictions'),
  leaderboard: (groupId?: Id) => key('leaderboard', asText(groupId)),
  /** Cuelga del ranking: invalidar `leaderboard(groupId)` también lo invalida. */
  leaderboardLogs: (groupId: Id) => key('leaderboard', asText(groupId), 'logs'),
  leaderboardMatchdays: (groupId?: Id) => key('leaderboardMatchdays', asText(groupId)),
  matchdayFixtures: (groupId?: Id, user?: Id, round?: string) =>
    key('matchdayFixtures', asText(groupId), user, round),
  /** Todos los partidos de una liga que elige los suyos, para su portada; cuelga de matchdayFixtures. */
  leagueMatches: (groupId?: Id) => key('matchdayFixtures', asText(groupId), 'league'),
  /** Cuelga de matchdayFixtures: lo que refresca los partidos de la liga refresca también esto. */
  survivorStatus: (groupId: Id, user?: Id) =>
    key('matchdayFixtures', asText(groupId), 'survivor', user),
  matchFriendPredictions: (groupId?: Id, matchId?: Id) =>
    key('matchFriendPredictions', asText(groupId), matchId),
  matchdayStats: (groupId?: Id) => key('matchdayStats', asText(groupId)),
  /** Cuelga de matchdayStats: al invalidar las estadísticas de la liga se refrescan también. */
  matchVoters: (groupId: Id, matchIds: string) =>
    key('matchdayStats', asText(groupId), 'voters', matchIds),
  /** También cuelga de matchdayStats, para refrescarse con cada predicción nueva de la liga. */
  roundParticipants: (groupId: Id, matchIds: string) =>
    key('matchdayStats', asText(groupId), 'participants', matchIds),
  standings: () => key('standings'),
  odds: () => key('odds'),
  topScorers: () => key('topScorers'),
  officialBracket: () => key('officialBracket'),
  predictionScore: (predictionId?: Id) => key('predictionScore', asText(predictionId)),
  matches: (competitionId?: Id) => key('matches', competitionId),
  radar: (competitionId?: Id) => key('radar', competitionId),
  competitionStandings: (competitionId?: Id) => key('competitionStandings', competitionId),
  customMatches: (groupId?: Id) => key('customMatches', asText(groupId)),
  customTeams: (groupId?: Id) => key('customTeams', asText(groupId)),
  customLockState: (groupId?: Id) => key('customLockState', asText(groupId)),
  matchSelection: (groupId?: Id) => key('matchSelection', asText(groupId)),
  /** Calendario de una o varias competiciones (la principal primero) para elegir partidos. */
  selectableMatches: (competitionIds?: number[]) =>
    key('selectableMatches', competitionIds?.join(',')),
};
