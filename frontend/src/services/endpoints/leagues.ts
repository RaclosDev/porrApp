/** Ligas: creación, competición personalizada, ajustes, puntuación y miembros. */
import type {
  Group,
  LeagueSummary,
  GroupMember,
  JoinCodeResponse,
  LeagueScoring,
  LeagueImageResponse,
  LeagueStanding,
  MatchSelectionRequest,
  MatchSelectionView,
  Match,
  PaymentStatus,
  PaymentStatusResponse,
  PoolFormat,
  ScoringRules,
  StatusResponse,
} from '../../types/api';
import { request, imageForm } from '../http';

export const fetchMyGroups = () => request<Group[]>('/groups/mine');

export const fetchMyLeagueSummaries = () => request<LeagueSummary[]>('/groups/mine/summary');

export const fetchGroup = (id: number | string) => request<Group>(`/groups/${id}`);

/** Liga pública destacada (portada, demo y entrada de invitados). */
export const fetchFeaturedGroup = () => request<Group>('/groups/featured');

/** Metadatos públicos de una invitación, sin unirse a la liga. */
export const fetchGroupInvitationPreview = (joinCode: string) =>
  request<Group>(`/groups/preview/${encodeURIComponent(joinCode)}`);

/**
 * Liga nueva (POST /groups): o `competitionId` o `customCompetitionName`. Los ajustes opcionales
 * (normas, cuota, puntuación y cierre) dejan la liga configurada; si alguno no es válido, no se crea.
 */
export interface CreateGroupRequest {
  name: string;
  competitionId: number | null;
  customCompetitionName?: string;
  poolFormat: PoolFormat;
  pichichi: boolean;
  rules?: string;
  entryFee?: boolean;
  scoring?: ScoringRules;
  lockMode?: CustomLockMode;
  lockOffsetMinutes?: number;
  /** Fecha y hora de Madrid (`YYYY-MM-DDTHH:mm`), solo con `lockMode = FIXED_DATE`. */
  lockDate?: string;
  /** Partidos que entran en una liga por jornadas; sin él, todos. */
  matchSelection?: MatchSelectionRequest;
}

/** Calendario de una competición oficial para elegir los partidos de una liga nueva. */
export const fetchSelectableMatches = (competitionId: number) =>
  request<MatchSelectionView>(`/competitions/${competitionId}/selectable-matches`);

/** Partidos que entran en la liga (solo su administrador). */
export const fetchMatchSelection = (groupId: number) =>
  request<MatchSelectionView>(`/groups/${groupId}/competition/match-selection`);

export const saveMatchSelection = (groupId: number, selection: MatchSelectionRequest) =>
  request<MatchSelectionView>(`/groups/${groupId}/competition/match-selection`, {
    method: 'PUT',
    json: selection,
    fallbackError: 'No se pudieron guardar los partidos',
  });

export const createGroup = (league: CreateGroupRequest, idempotencyKey?: string) =>
  request<Group>('/groups', {
    method: 'POST',
    json: league,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    fallbackError: 'Error al crear la liga',
  });

export interface CustomTeam {
  id: number;
  name: string;
  groupName: string | null;
  logoUrl: string | null;
}
export const fetchCustomTeams = (groupId: number) =>
  request<CustomTeam[]>(`/groups/${groupId}/competition/teams`);
export const fetchCustomMatches = (groupId: number) =>
  request<Match[]>(`/groups/${groupId}/competition/matches`);
export const fetchCustomStandings = (groupId: number) =>
  request<LeagueStanding[]>(`/groups/${groupId}/competition/standings`);
export const addCustomTeam = (
  groupId: number,
  name: string,
  groupName?: string,
  logoUrl?: string,
) =>
  request<CustomTeam>(`/groups/${groupId}/competition/teams`, {
    method: 'POST',
    json: { name, groupName, logoUrl },
  });
/** Cambia o quita (con null) el escudo de un equipo de la competición personalizada. */
export const setCustomTeamLogo = (groupId: number, teamId: number, logoUrl: string | null) =>
  request<CustomTeam>(`/groups/${groupId}/competition/teams/${teamId}/logo`, {
    method: 'PUT',
    json: { logoUrl },
  });
export const deleteCustomTeam = (groupId: number, teamId: number) =>
  request<void>(`/groups/${groupId}/competition/teams/${teamId}`, { method: 'DELETE' });
/** Cuándo se cierran los pronósticos de una competición personalizada. */
export type CustomLockMode = 'FIXED_DATE' | 'FIRST_MATCH' | 'PER_ROUND' | 'PER_MATCH' | 'PER_DAY';

/** Qué partes del pronóstico están ya cerradas (GET /groups/{id}/competition/lock-state). */
interface CustomLockState {
  mode: CustomLockMode;
  offsetMinutes: number;
  lockDate: string | null;
  lockedGroups: string[];
  /** Por ronda del cuadro, qué ganadores están cerrados (índice = cruce). */
  lockedPicks: boolean[][];
  anyLocked: boolean;
  fullyLocked: boolean;
  nextLockAt: string | null;
  /** Eliminatorias sorteadas ronda a ronda: sus rondas y cruces; null en el resto. */
  knockoutRounds?: KnockoutRound[] | null;
}

/** Cruce de unas eliminatorias sorteadas: el local es el de la ida; `winner`, quién pasa. */
export interface KnockoutTie {
  home: string | null;
  away: string | null;
  winner: string | null;
  /** Sus partidos (ida y vuelta, o uno solo), por fecha. */
  matchIds: number[];
}

/** Ronda de unas eliminatorias sorteadas ronda a ronda («playoff», «r16», «qf», «sf», «final»…). */
export interface KnockoutRound {
  round: string;
  /** Ya se conocen todos sus cruces: se puede pronosticar. */
  drawn: boolean;
  expectedTies: number;
  ties: KnockoutTie[];
}

export const fetchCustomLockState = (groupId: number) =>
  request<CustomLockState>(`/groups/${groupId}/competition/lock-state`);
export const setCustomLockConfig = (
  groupId: number,
  config: { mode: CustomLockMode; offsetMinutes: number; lockDate: string | null },
) =>
  request<CustomLockState>(`/groups/${groupId}/competition/lock`, {
    method: 'PUT',
    json: config,
  });
/** Pasa la liga de cuadro personalizado a una competición oficial con cuadro propio. */
export const linkOfficialCompetition = (groupId: number, competitionId: number) =>
  request<void>(`/groups/${groupId}/competition/link-official`, {
    method: 'POST',
    json: { competitionId },
  });
export const addCustomMatch = (
  groupId: number,
  homeTeamId: number,
  awayTeamId: number | null,
  matchDate: string | null,
  round?: string,
) =>
  request<Match>(`/groups/${groupId}/competition/matches`, {
    method: 'POST',
    json: { homeTeamId, awayTeamId, matchDate, round },
  });
export const setCustomResult = (
  groupId: number,
  matchId: number,
  homeScore: number,
  awayScore: number,
  winnerTeamId?: number,
) =>
  request<Match>(`/groups/${groupId}/competition/matches/${matchId}/result`, {
    method: 'PUT',
    json: { homeScore, awayScore, winnerTeamId },
  });
export const setCustomMatchDate = (groupId: number, matchId: number, matchDate: string | null) =>
  request<Match>(`/groups/${groupId}/competition/matches/${matchId}/date`, {
    method: 'PUT',
    json: { matchDate },
  });
export const deleteCustomMatch = (groupId: number, matchId: number) =>
  request<void>(`/groups/${groupId}/competition/matches/${matchId}`, { method: 'DELETE' });

export const updateGroup = (
  id: number | string,
  name: string | undefined,
  rules: string | undefined,
) =>
  request<Group>(`/groups/${id}`, {
    method: 'PUT',
    json: { name, rules },
    fallbackError: 'Error al actualizar la liga',
  });

/** Activa o quita la cuota de inscripción de una liga privada. */
export const updateGroupEntryFee = (id: number | string, entryFee: boolean) =>
  request<Group>(`/groups/${id}`, {
    method: 'PUT',
    json: { entryFee },
    fallbackError: 'No se pudo cambiar la cuota',
  });

export const deleteGroup = (id: number | string) =>
  request<StatusResponse>(`/groups/${id}`, {
    method: 'DELETE',
    fallbackError: 'Error al borrar la liga',
  });

export const joinGroup = (joinCode: string) =>
  request<Group>('/groups/join', {
    method: 'POST',
    json: { joinCode },
    fallbackError: 'Grupo no encontrado o código inválido',
  });

export const leaveGroup = (id: number | string) =>
  request<StatusResponse>(`/groups/${id}/leave`, {
    method: 'DELETE',
    fallbackError: 'Error al abandonar el grupo',
  });

/** Reglas de puntuación de la liga, las de por defecto y si quien consulta puede cambiarlas. */
export const fetchLeagueScoring = (groupId: number | string) =>
  request<LeagueScoring>(`/groups/${groupId}/scoring`);

/** Cambia la puntuación de la liga; el servidor recalcula los puntos. Solo el administrador. */
export const updateLeagueScoring = (groupId: number | string, rules: ScoringRules) =>
  request<LeagueScoring>(`/groups/${groupId}/scoring`, {
    method: 'PUT',
    json: rules,
    fallbackError: 'No se pudo guardar la puntuación',
  });

export const fetchGroupMembers = (groupId: number | string) =>
  request<GroupMember[]>(`/groups/${groupId}/members`);

export const toggleGroupMemberPayment = (
  groupId: number | string,
  userId: number,
  status: PaymentStatus,
) =>
  request<PaymentStatusResponse>(`/groups/${groupId}/members/${userId}/payment`, {
    method: 'PUT',
    json: { status },
    fallbackError: 'Error al actualizar estado de pago',
  });

export const kickGroupMember = (groupId: number | string, userId: number) =>
  request<StatusResponse>(`/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    fallbackError: 'Error al expulsar al miembro',
  });

export const regenerateGroupJoinCode = (groupId: number | string) =>
  request<JoinCodeResponse>(`/groups/${groupId}/regenerate-code`, {
    method: 'POST',
    fallbackError: 'Error al regenerar código',
  });

export const uploadGroupImage = (groupId: number | string, blob: Blob) =>
  request<LeagueImageResponse>(`/groups/${groupId}/image`, {
    method: 'PUT',
    form: imageForm(blob),
  });

export const deleteGroupImage = (groupId: number | string) =>
  request<LeagueImageResponse>(`/groups/${groupId}/image`, { method: 'DELETE' });

/** Cede la administración de la liga a otro miembro. */
export const transferGroupAdmin = (groupId: number | string, userId: number) =>
  request<StatusResponse>(`/groups/${groupId}/members/${userId}/admin`, {
    method: 'PUT',
    fallbackError: 'No se pudo ceder la administración',
  });
