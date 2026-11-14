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
  /** Marcadores de juegos; cada marcador cuelga del prefijo, así que invalidarlo refresca todos. */
  trackers: () => key('trackers'),
  poker: (id: Id) => key('poker', asText(id)),
  pokerHistory: (id: Id) => key('poker', asText(id), 'history'),
  pokerMusic: (id: Id) => key('poker', asText(id), 'music'),
  tracker: (id: Id) => key('trackers', asText(id)),
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
  /** Grandes Premios de una liga de Fórmula 1 con la predicción del usuario. */
  grandPrix: (groupId?: Id, user?: Id) => key('grandPrix', asText(groupId), user),
  /** Cuelga de grandPrix: al guardar se refrescan también las de la liga. */
  grandPrixPicks: (groupId: Id, matchId: number) =>
    key('grandPrix', asText(groupId), 'picks', matchId),
  /** Las de todos los Grandes Premios cerrados; también cuelga de grandPrix. */
  grandPrixSeasonPicks: (groupId: Id) => key('grandPrix', asText(groupId), 'picks'),
  grandPrixClassification: (groupId: Id, matchId: number) =>
    key('grandPrixClassification', asText(groupId), matchId),
  /** Mundial de F1: es el mismo para todas las ligas, la liga solo comprueba el acceso. */
  formulaOneStandings: (groupId: Id) => key('formulaOneStandings', asText(groupId)),
  matchdayFixtures: (groupId?: Id, user?: Id, round?: string) =>
    key('matchdayFixtures', asText(groupId), user, round),
  /** La jornada en curso de una liga que elige sus partidos, para su portada; cuelga de matchdayFixtures. */
  leagueCurrentRound: (groupId?: Id) => key('matchdayFixtures', asText(groupId), 'current'),
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
  /** Datos oficiales de un torneo con fase de grupos, por competición. */
  tournamentStandings: (competitionId?: Id) => key('tournamentStandings', competitionId),
  tournamentGroupOdds: (competitionId?: Id) => key('tournamentGroupOdds', competitionId),
  tournamentFormat: (competitionId?: Id) => key('tournamentFormat', competitionId),
  tournamentTopScorers: (competitionId?: Id) => key('tournamentTopScorers', competitionId),
  tournamentOfficialBracket: (competitionId?: Id) =>
    key('tournamentOfficialBracket', competitionId),
  /** Jugadores de una competición entre los que se elige el pichichi. */
  competitionPlayers: (competitionId?: Id) => key('competitionPlayers', competitionId),
  /** Pichichi de la liga para quien consulta. */
  scorerPick: (groupId?: Id) => key('scorerPick', asText(groupId)),
  /** Cuelga de `scorerPick`: al cambiar el propio se refrescan también los de la liga. */
  scorerPicks: (groupId: Id) => key('scorerPick', asText(groupId), 'all'),
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
