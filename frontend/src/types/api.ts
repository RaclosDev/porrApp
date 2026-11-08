/**
 * Contrato JSON de la API. Cada tipo refleja un DTO del backend
 * (paquete com.porra.mundial.dto); los nombres de campo coinciden con el JSON.
 */

export type PoolFormat =
  'FULL_BRACKET' | 'KNOCKOUTS_ONLY' | 'MATCH_DAY' | 'SURVIVOR' | 'GRAND_PRIX';
/** RACE: Fórmula 1, Gran Premio a Gran Premio. */
/** `EVENTS`: competición por veladas (la UFC), cada velada es una jornada con su nombre. */
type CompetitionFormat = 'LEAGUE' | 'TOURNAMENT' | 'RACE' | 'EVENTS';
export type PaymentStatus = 'PAID' | 'PENDING';

export interface StatusResponse {
  status: string;
  message?: string;
}

// --- Usuario y sesión ---

export interface LoginResponse {
  token: string;
  userId: number;
  participantName: string;
  status: 'login_success';
  lastSelectedGroupId: number;
  avatarUrl: string;
}

export interface Me {
  profileSetupCompleted: boolean;
  userId: number;
  participantName: string;
  lastSelectedGroupId: number | null;
  avatarUrl: string | null;
}

export interface ProfileResponse {
  status: string;
  participantName: string;
  avatarUrl: string | null;
}

export interface UserPreferences {
  lastSelectedGroupId: number | null;
}

// --- Competiciones y partidos ---

/** Deporte de una competición oficial (`Sport` en el servidor). */
export type Sport =
  | 'FOOTBALL'
  | 'LEAGUE_OF_LEGENDS'
  | 'FORMULA_1'
  | 'BASKETBALL'
  | 'AMERICAN_FOOTBALL'
  | 'TENNIS'
  | 'MMA';

/** Cuadro de un torneo de tenis (`CompetitionDTO.TennisInfo` en el servidor). */
export interface TennisInfo {
  /** Id del torneo en ESPN: los dos cuadros de un torneo lo comparten. */
  tournamentId: number;
  /** Nombre del torneo, sin el cuadro. */
  tournament: string;
  level: 'GRAND_SLAM' | 'MASTERS_1000' | 'FINALS';
  draw: 'MEN' | 'WOMEN';
  /** Sets que hay que ganar: 3 en los Grand Slams masculinos, 2 en el resto. */
  setsToWin: number;
  /** Fechas de la edición actual (la que se juega o la próxima); null si ESPN no la tiene. */
  startDate: string | null;
  endDate: string | null;
}

export interface Competition {
  id: number;
  name: string;
  externalId: string;
  formatType: CompetitionFormat;
  /** Lo manda `GET /competitions`; falta en datos guardados antes de existir. */
  sport?: Sport;
  /** Ya se han jugado todos sus partidos importados. */
  finished?: boolean;
  /** Si tiene fase de grupos; null mientras no haya partidos importados. */
  groupStage?: boolean | null;
  /** Sus eliminatorias se sortean ronda a ronda (Champions, Copa del Rey…): se pronostican ronda a ronda. */
  knockoutDraw?: boolean;
  /** Torneo y cuadro de un torneo de tenis; null en otros deportes. */
  tennis?: TennisInfo | null;
}

export interface Match {
  id: number;
  home: string;
  away: string;
  home_team_id: number | null;
  away_team_id: number | null;
  homeLogo: string | null;
  awayLogo: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  home_score: number | null;
  away_score: number | null;
  date: string | null;
  finished: boolean;
  round: string;
  groupName: string | null;
  winner: string | null;
  displayClock: string | null;
  isStartingSoon: boolean;
  status: string;
  /** Datos de pelea; solo en los partidos de la UFC. */
  fight?: FightInfo | null;
}

export interface MatchRadar {
  live: Match[];
  last: Match[];
  next: Match[];
}

/** Estadísticas de un equipo en su grupo (StandingsService). */
export interface TeamStanding {
  pts: number;
  diff: number;
  gls: number;
  mp: number;
  fp: number;
  pos: number;
  /** 0 en juego, 1-4 puesto asegurado, 5 entre los dos primeros, -1 eliminado. */
  status: number;
}

/** Clasificación de grupos: grupo -> equipo -> estadísticas. */
export type GroupStandings = Record<string, Record<string, TeamStanding>>;

export interface LeagueStanding {
  /** Grupo, conferencia o fase («Grupo A», «Fase suiza»…) si la competición tiene varias tablas. */
  group?: string | null;
  rank: number;
  teamName: string;
  teamLogo: string | null;
  points: number;
  gamesPlayed: number;
  wins: number;
  ties: number;
  losses: number;
  goalDiff: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TeamOdds {
  name: string;
  win: number | null;
  qualify: number | null;
  outright: number | null;
}

/** Probabilidades por grupo: "A" -> equipos. */
export type GroupOdds = Record<string, TeamOdds[]>;

export interface TopScorer {
  name: string;
  shortName: string;
  goals: number;
  position: string;
  playerId: string;
  team: string;
  imageUrl: string;
}

// --- Pronósticos de cuadro completo ---

export type TeamPair = [string | null, string | null] | string[];

/** Cuadro pronosticado (o el oficial). */
export interface PredictionData {
  topologyVersion?: 1 | 2;
  user?: string;
  prediction?: string;
  groups?: Record<string, string[]>;
  thirds?: string[];
  /** Ganadores por ronda; null en lo que otro participante aún puede cambiar (cierre por partes). */
  customRounds?: (string | null)[][];
  /** Playoffs de la NBA: en cuántos partidos se gana cada serie (4 a 7), alineado con `customRounds`. */
  customSeriesGames?: (number | null)[][];
  r32?: TeamPair[];
  /** Mismo contenido que r32; el backend lo sigue enviando para pronósticos antiguos. */
  r1?: TeamPair[];
  r16?: TeamPair[];
  qf?: TeamPair[];
  sf?: TeamPair[];
  final?: string[];
  champion?: string | null;
  thirdPlaceWinner?: string | null;
  thirdPlaceMatch?: string[];
  scorer?: string | null;
}

export interface PredictionSummary {
  key: string;
  hash: string | null;
  paid: boolean;
  participantName: string;
  userId: number | null;
  predictionName: string | null;
  groupId: number | null;
  data: PredictionData | null;
}

export interface PredictionSaved {
  id: number;
  participantName?: string;
  groupId?: string;
  status: 'creada_con_exito';
}

// --- Clasificación ---

export interface ScoreLogEntry {
  stage: string;
  amount: number;
  msg: string;
}

export interface ParticipantScore {
  id: number;
  userId: number | null;
  name: string;
  predictionName: string | null;
  avatarUrl: string | null;
  thirdPlaceMatch: string[] | null;
  thirdPlaceWinner: string | null;
  r1: number;
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  finals: number;
  scorer: number;
  matchPoints: number;
  total: number;
  /** Solo en el desglose de un pronóstico (`/predictions/{id}/score`); la clasificación no lo trae. */
  log?: ScoreLogEntry[] | null;
  /** grupo -> posición (1-4) -> acertada. Solo en el desglose. */
  exactMatches?: Record<string, Record<string, boolean>> | null;
  passedTeams?: Record<string, boolean> | null;
  pending: boolean;
  /** Liga superviviente: ya ha caído y sus jornadas superadas no suben más. */
  eliminated?: boolean;
}

export interface MatchdayPoints {
  label: string;
  date: string | null;
  finished: boolean;
  current: boolean;
  matchCount: number;
  /** id del pronóstico -> puntos en la jornada. */
  pointsByPrediction: Record<string, number>;
}

// --- Ligas ---

/** Situación del usuario en una de sus ligas; rank y points son null si aún no tiene predicción. */
export interface LeagueSummary {
  groupId: number;
  rank: number | null;
  points: number | null;
  participants: number;
  pendingPredictions: number;
}

export interface Group {
  id: number;
  name: string;
  joinCode: string | null;
  /** Liga pública: cualquiera puede consultarla sin ser miembro. */
  publicLeague?: boolean;
  /** Liga con cuota de inscripción: el ranking marca a quien no ha pagado. */
  entryFee?: boolean;
  adminParticipantName: string | null;
  adminUserId: number | null;
  createdAt: string | null;
  /** Cuándo se unió el usuario (solo en sus ligas, `/groups/mine`). */
  joinedAt?: string | null;
  competitionId: number | null;
  customCompetition?: boolean;
  competitionExternalId?: string | null;
  competitionName: string | null;
  formatType: CompetitionFormat | null;
  /** Eliminatorias sorteadas ronda a ronda: en cada ronda se elige quién pasa cada cruce. */
  knockoutDraw?: boolean;
  poolFormat: PoolFormat | null;
  pichichi: boolean | null;
  lockDate: string | null;
  isLocked: boolean | null;
  rules: string | null;
  imageUrl: string | null;
  /** Liga por jornadas: entran todos los partidos de la competición o solo los elegidos. */
  matchSelection?: MatchSelectionMode | null;
  /** Junta partidos de varias competiciones (la de `competitionId` es la principal); sus jornadas son semanas. */
  multiCompetition?: boolean;
  /** Tenis de varios torneos: cuáles sigue; null en una liga de un solo torneo. */
  tennisScope?: TennisScope | null;
  /** Tenis de varios torneos: cuadros que sigue. */
  tennisTour?: TennisTour | null;
}

type MatchSelectionMode = 'ALL' | 'CUSTOM';

/** Partido del calendario al elegir los de una liga. */
export interface SelectableMatch {
  id: number;
  /** Jornada como la agrupa la liga ("Jornada 12", "Grupo A", "Semana 2026-11-02"…). */
  round: string;
  /** Competición del partido. */
  competitionId: number | null;
  date: string | null;
  homeTeamId: number | null;
  home: string;
  homeLogo: string | null;
  awayTeamId: number | null;
  away: string;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Entra ahora en la liga. */
  selected: boolean;
  /** Ya no admite predicciones. */
  closed: boolean;
  /** Cerrado y con predicciones: se queda en la liga para no cambiar la clasificación. */
  locked: boolean;
  /** Predicciones de la liga sobre este partido. */
  predictions: number;
}

export interface SelectableTeam {
  id: number;
  name: string;
  logoUrl: string | null;
}

/** Selección de partidos de una liga, o el calendario de una competición al crearla. */
/** Competición de la que una liga toma partidos. */
interface SelectableCompetition {
  id: number;
  name: string;
  externalId: string | null;
  /** Tiene partidos cerrados con predicciones en la liga: no se puede quitar. */
  locked: boolean;
  /** Calendario para crear la liga: no tenía partidos y se están cargando ahora de ESPN. */
  importing?: boolean;
  /** Por qué sigue sin partidos (ESPN ha fallado o aún no los ha publicado). */
  importError?: string | null;
}

export interface MatchSelectionView {
  mode: MatchSelectionMode;
  /** Competiciones de la liga, la principal primero; con más de una, sus jornadas son semanas. */
  competitionIds: number[];
  competitions: SelectableCompetition[];
  teamIds: number[];
  includedMatchIds: number[];
  excludedMatchIds: number[];
  teams: SelectableTeam[];
  matches: SelectableMatch[];
  /** Predicciones borradas al guardar (de partidos abiertos que se han quitado). */
  removedPredictions: number;
  /** Partidos que se pidió quitar pero se quedan: ya cerrados y con predicciones. */
  keptMatches: number;
}

/** UFC: veladas numeradas («UFC 334») o el resto (Fight Night y demás sin número). */
export type EventSeries = 'NUMBERED' | 'FIGHT_NIGHT';

/** Tenis: torneos de una liga de varios (todos, Grand Slams o Masters 1000 con las ATP Finals). */
export type TennisScope = 'ALL' | 'GRAND_SLAMS' | 'MASTERS_1000';

/** Tenis de varios torneos: cuadros masculinos (ATP), femeninos (WTA) o los dos. */
export type TennisTour = 'ATP' | 'WTA' | 'BOTH';

/** UFC: partes de la cartelera de una velada (estelar, preliminares y preliminares tempranos). */
export type CardSegment = 'EARLY_PRELIMS' | 'PRELIMS' | 'MAIN';

export interface MatchSelectionRequest {
  mode: MatchSelectionMode;
  /** UFC con todas las veladas: solo las de una serie; sin ella, las que ya tenía (al crear, todas). */
  eventSeries?: EventSeries;
  /** UFC: partes de la cartelera que entran; sin ellas, las que ya tenía (al crear, la velada completa). */
  cardSegments?: CardSegment[];
  /** Tenis: la liga sigue varios torneos y suma los nuevos; sin él, el que ya tenía (al crear, uno). */
  tennisScope?: TennisScope;
  /** Tenis con `tennisScope`: cuadros que sigue; sin él, los que ya tenía (al crear, los dos). */
  tennisTour?: TennisTour;
  /** Competiciones de la liga, con la principal; sin ellas, las que ya tenía. */
  competitionIds?: number[];
  teamIds?: number[];
  includedMatchIds?: number[];
  excludedMatchIds?: number[];
}

/** Puntos por cada acierto; los nombres son los del backend (`ScoringRuleSet`). */
export interface ScoringRules {
  groupQualifierPoints: number;
  groupExactPositionPoints: number;
  roundOf32Points: number;
  roundOf16Points: number;
  quarterFinalPoints: number;
  semiFinalPoints: number;
  championPoints: number;
  runnerUpPoints: number;
  thirdPlacePoints: number;
  fourthPlacePoints: number;
  topScorerPoints: number;
  exactScorePoints: number;
  correctSignPoints: number;
  goalDiffBonusPoints: number;
  /** Superviviente: puntos por jornada superada. */
  survivorRoundPoints: number;
  /** Superviviente: fallos que aguanta cada participante (1: el primero lo elimina). */
  survivorLives: number;
  /** Superviviente: 1 si un empate también supera la jornada. */
  survivorDrawSurvives: number;
  /** UFC: ganador acertado. */
  fightWinnerPoints: number;
  /** UFC: se suma si además aciertas el método. */
  fightMethodPoints: number;
  /** UFC: se suma si además aciertas el asalto de un KO/TKO o una sumisión. */
  fightRoundPoints: number;
  /** Playoffs de la NBA: por partido del play-in acertado. */
  nbaPlayInPoints: number;
  /** Playoffs de la NBA: por serie acertada en cada ronda. */
  nbaFirstRoundPoints: number;
  nbaConferenceSemifinalPoints: number;
  nbaConferenceFinalPoints: number;
  nbaFinalsPoints: number;
  /** Playoffs de la NBA: extra por acertar también en cuántos partidos se gana la serie. */
  nbaFirstRoundExactPoints: number;
  nbaConferenceSemifinalExactPoints: number;
  nbaConferenceFinalExactPoints: number;
  nbaFinalsExactPoints: number;
  /** Fórmula 1: cada piloto del podio en su puesto exacto. */
  f1ExactPositionPoints: number;
  /** Fórmula 1: cada piloto que sube al podio en otro puesto. */
  f1PodiumPoints: number;
  f1PolePoints: number;
  f1FastestLapPoints: number;
}

/** Podio, pole y vuelta rápida de un Gran Premio (ids de piloto); cualquiera puede faltar. */
export interface GrandPrixPicks {
  first: number | null;
  second: number | null;
  third: number | null;
  pole: number | null;
  fastestLap: number | null;
}

export interface RaceDriver {
  id: number;
  name: string;
  shortName: string | null;
  country: string | null;
  flagUrl: string | null;
  team: string | null;
  /** Hexadecimal sin almohadilla. */
  teamColor: string | null;
  number: string | null;
}

type GrandPrixStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'POSTPONED';

export interface GrandPrix {
  id: number;
  name: string;
  circuit: string | null;
  city: string | null;
  country: string | null;
  sprint: boolean;
  /** Cierre: empieza la clasificación. */
  lockAt: string | null;
  raceAt: string | null;
  status: GrandPrixStatus;
  locked: boolean;
  /** Pilotos que se pueden elegir. */
  gridIds: number[];
  result: GrandPrixPicks | null;
  pick: GrandPrixPicks | null;
  points: number | null;
  details: string | null;
}

export interface GrandPrixBoard {
  grandsPrix: GrandPrix[];
  drivers: RaceDriver[];
  rules: { exactPosition: number; podium: number; pole: number; fastestLap: number };
}

export interface GrandPrixMemberPick {
  userId: number | null;
  name: string;
  avatarUrl: string | null;
  mine: boolean;
  pick: GrandPrixPicks;
  points: number | null;
  details: string | null;
}

export type ScoringRuleKey = keyof ScoringRules;

/** Puntuación de una liga: sus reglas, las de por defecto y si quien la ve puede cambiarlas. */
export interface LeagueScoring {
  matchSignOnly?: boolean;
  /**
   * Deporte de la competición de la liga: en la NFL se puntúa el ganador, sin empate; en tenis, el
   * ganador de cada ronda y los sets.
   */
  sport?: Sport | null;
  /** Eliminatorias sorteadas ronda a ronda: se puntúa cada cruce acertado según su ronda. */
  knockoutDraw?: boolean;
  /** Liga de la UFC: se puntúan ganador, método y asalto de cada pelea. */
  fights?: boolean;
  /** Playoffs de la NBA: puntos por serie acertada y extra por acertar en cuántos partidos. */
  nbaSeries?: boolean;
  poolFormat: PoolFormat | null;
  pichichi: boolean;
  editable: boolean;
  maxPoints: number;
  rules: ScoringRules;
  defaults: ScoringRules;
}

export interface GroupMember {
  userId: number;
  participantName: string;
  role: string;
  /** null en las ligas públicas, que no tienen pagos. */
  paymentStatus: PaymentStatus | null;
  joinedAt: string | null;
  isAdmin: boolean;
  avatarUrl: string | null;
}

export interface PaymentStatusResponse {
  status: string;
  paymentStatus: PaymentStatus;
}

export interface JoinCodeResponse {
  joinCode: string;
}

export interface LeagueImageResponse {
  status: string;
  imageUrl: string | null;
}

// --- Pronósticos por jornada ---

export interface MatchdayFixture {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  matchDate: string | null;
  round: string | null;
  groupName: string | null;
  /** Competición del partido, solo en las ligas que juntan varias. */
  competitionName?: string | null;
  /** Deporte del partido: en la NFL se predice quién gana, sin X. */
  sport?: Sport | null;
  finished: boolean | null;
  status: string | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  displayClock: string | null;
  /** Tenis: sets que hay que ganar (2 o 3). Falta en el resto de deportes. */
  setsToWin?: number | null;
  /** Tenis: quién ha ganado, también tras una retirada o un W.O., que no tienen marcador. */
  winnerSign?: '1' | '2' | null;
  predHomeScore: number | null;
  predAwayScore: number | null;
  predSign: string | null;
  /** Pelea de la UFC: método (KO_TKO, SUBMISSION, DECISION) y asalto elegidos. */
  predMethod?: string | null;
  predRound?: number | null;
  /** Datos de pelea; solo en las ligas de la UFC. */
  fight?: FightInfo | null;
  locked: boolean;
  lockReason: string | null;
  /** Aún falta un rival («Por definir»): cerrado hasta que se conozcan los dos. */
  awaitingTeams?: boolean;
  /** Cuándo se cierra el pronóstico; puede ser antes de que empiece el partido. */
  lockAt?: string | null;
  pointsAwarded: number | null;
  isExactScore: boolean | null;
  isCorrectSign: boolean | null;
  scoringDetails: string | null;
}

export interface MatchdayPredictionInput {
  matchId: number;
  homeScore: number | null;
  awayScore: number | null;
  sign: '1' | 'X' | '2' | string | null;
  /** Pelea de la UFC: método y asalto, opcionales. */
  method?: FightMethod | null;
  round?: number | null;
}

/** Métodos que se pueden predecir en una pelea. */
export type FightMethod = 'KO_TKO' | 'SUBMISSION' | 'DECISION';

/** Datos de una pelea de la UFC (`FightInfoDTO`). */
export interface FightInfo {
  eventId: string;
  eventName: string | null;
  /** Bloque de la cartelera. */
  segment: CardSegment | null;
  /** 1 es la pelea estelar. */
  order: number | null;
  weightClass: string | null;
  scheduledRounds: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
  /** Cómo acabó; null si no ha acabado. */
  resultMethod: FightMethod | 'DRAW' | 'NO_CONTEST' | 'DISQUALIFICATION' | 'OTHER' | null;
  resultDetail: string | null;
  resultRound: number | null;
  resultClock: string | null;
  /** '1' ganó la esquina roja (local), '2' la azul; null sin ganador. */
  winner: '1' | '2' | null;
}

/** Elección de una jornada en una liga superviviente. */
interface SurvivorPick {
  matchId: number;
  round: string;
  teamId: number | null;
  teamName: string | null;
  teamLogo: string | null;
  /** WON: su equipo ganó; LOST: no ganó (eliminado); PENDING: por jugar o en juego. */
  result: 'WON' | 'LOST' | 'PENDING';
}

/** Situación del usuario en una liga superviviente (`/predictions/matchday/survivor`). */
export interface SurvivorStatus {
  eliminated: boolean;
  survived: number;
  /** Jornada en que cayó, o null si sigue vivo. */
  eliminatedRound: string | null;
  /** Cayó por no elegir equipo en esa jornada. */
  missed: boolean;
  picks: SurvivorPick[];
  /** Vidas que le quedan. */
  livesLeft?: number;
  /** Vidas con las que empieza cada participante en esta liga. */
  lives?: number;
  /** En esta liga un empate también supera la jornada. */
  drawSurvives?: boolean;
}

export interface MatchdaySubmissionResult {
  success: boolean;
  saved: number;
  message: string;
}

export interface FriendPrediction {
  userId: number;
  participantName: string;
  avatarUrl: string | null;
  homeScore: number | null;
  awayScore: number | null;
  sign: string | null;
  /** Pelea de la UFC: método y asalto elegidos. */
  method?: string | null;
  round?: number | null;
  pointsAwarded: number | null;
  isExactScore: boolean | null;
  isCorrectSign: boolean | null;
  scoringDetails: string | null;
  updatedAt: string | null;
  isCaller: boolean;
  hasPredicted: boolean;
}

// --- Estadísticas de las ligas por jornadas ---

/** Marcador pronosticado y cuántos lo han puesto. */
interface ScoreCount {
  home: number;
  away: number;
  count: number;
}

/** Reparto de los pronósticos de la liga en un partido que ya ha empezado. */
export interface MatchStats {
  matchId: number;
  round: string;
  matchDate: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  finished: boolean;
  live: boolean;
  homeScore: number | null;
  awayScore: number | null;
  predictions: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  topScores: ScoreCount[];
  /** null mientras el partido no ha terminado. */
  exactHits: number | null;
  signHits: number | null;
  /** UFC: cuántos eligieron cada método, del más elegido al menos; vacío en el resto. */
  methods?: MethodCount[];
}

/** Un método de victoria pronosticado en una pelea de la UFC y cuántos lo eligieron. */
interface MethodCount {
  method: string;
  count: number;
}

/** Un miembro que ha pronosticado un signo. */
export interface MatchVoter {
  userId: number;
  name: string;
  avatarUrl: string | null;
}

/** Quién ha pronosticado 1, X y 2 en un partido ya cerrado (`/stats/voters`). */
export interface MatchVoters {
  matchId: number;
  home: MatchVoter[];
  draw: MatchVoter[];
  away: MatchVoter[];
}

/** Estadísticas de una liga por jornadas (`/api/predictions/matchday/stats`). */
export interface MatchdayStats {
  members: number;
  matches: MatchStats[];
}
