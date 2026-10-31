/**
 * Contrato JSON de la API. Cada tipo refleja un DTO del backend
 * (paquete com.porra.mundial.dto); los nombres de campo coinciden con el JSON.
 */

export type PoolFormat = 'FULL_BRACKET' | 'KNOCKOUTS_ONLY' | 'MATCH_DAY';
export type CompetitionFormat = 'LEAGUE' | 'TOURNAMENT';
export type PaymentStatus = 'PAID' | 'PENDING';

/** Respuesta de error de cualquier endpoint. */
export interface ApiError {
  error: string;
}

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

export interface Competition {
  id: number;
  name: string;
  externalId: string;
  formatType: CompetitionFormat;
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
  /** 5 = clasificado matemáticamente, -1 = eliminado, 0 = en juego. */
  status: number;
}

/** Clasificación de grupos: grupo -> equipo -> estadísticas. */
export type GroupStandings = Record<string, Record<string, TeamStanding>>;

export interface LeagueStanding {
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
  user?: string;
  prediction?: string;
  groups?: Record<string, string[]>;
  thirds?: string[];
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
  status: 'creada_con_exito' | 'actualizada_con_exito';
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
  log: ScoreLogEntry[];
  /** grupo -> posición (1-4) -> acertada. */
  exactMatches: Record<string, Record<string, boolean>>;
  passedTeams: Record<string, boolean>;
  pending: boolean;
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

export interface Group {
  id: number;
  name: string;
  joinCode: string | null;
  adminParticipantName: string | null;
  adminUserId: number | null;
  createdAt: string | null;
  competitionId: number | null;
  competitionName: string | null;
  formatType: CompetitionFormat | null;
  poolFormat: PoolFormat | null;
  pichichi: boolean | null;
  lockDate: string | null;
  isLocked: boolean | null;
  rules: string | null;
  imageUrl: string | null;
}

export interface GroupMember {
  userId: number;
  participantName: string;
  /** null en la Porra Global, que no publica emails. */
  googleEmail: string | null;
  role: string;
  /** null en la Porra Global, que no tiene pagos. */
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
  finished: boolean | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  displayClock: string | null;
  predHomeScore: number | null;
  predAwayScore: number | null;
  predSign: string | null;
  locked: boolean;
  lockReason: string | null;
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
  pointsAwarded: number | null;
  isExactScore: boolean | null;
  isCorrectSign: boolean | null;
  scoringDetails: string | null;
  updatedAt: string | null;
  isCaller: boolean;
  hasPredicted: boolean;
}
