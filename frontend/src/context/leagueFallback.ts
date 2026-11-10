import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import type { TrackerSummary } from '../services/endpoints/trackers';
import { forgetGroupVisit, readGroupVisits } from '../store/useAppStore';
import type { Group } from '../types/api';
import { clearGroupDrafts } from '../utils/drafts';

const timeOf = (value: string | null | undefined) => (value ? Date.parse(value) || 0 : 0);

/**
 * Liga «más reciente» del usuario: la que se abre sola cuando la activa deja de estar disponible
 * (se ha salido, la han borrado o ya no tiene acceso) o cuando aún no hay ninguna elegida.
 *
 * Más reciente es la de **última actividad**: la última que el usuario abrió en este dispositivo (la
 * misma marca que ordena «Mis ligas»). Si no ha abierto ninguna de las que le quedan, la última a la
 * que se **unió** (fecha de alta) y, si el servidor no la envía, la creada más tarde.
 */
export function pickMostRecentLeague(
  groups: readonly Group[],
  visits: Record<string, number> = readGroupVisits(),
): string | null {
  if (groups.length === 0) return null;
  const ids = new Set(groups.map((g) => String(g.id)));
  const lastVisited = Object.entries(visits)
    .filter(([id, at]) => ids.has(id) && Number(at) > 0)
    .sort(([, a], [, b]) => Number(b) - Number(a))[0]?.[0];
  if (lastVisited) return lastVisited;
  const newest = [...groups].sort(
    (a, b) =>
      timeOf(b.joinedAt) - timeOf(a.joinedAt) ||
      timeOf(b.createdAt) - timeOf(a.createdAt) ||
      b.id - a.id,
  )[0];
  return String(newest.id);
}

/** Consultas que guardan datos de una liga concreta. */
const leagueScopedKeys = (groupId: string) => [
  queryKeys.group(groupId),
  queryKeys.groupMembers(groupId),
  queryKeys.leagueScoring(groupId),
  queryKeys.predictions(groupId),
  queryKeys.leaderboard(groupId),
  queryKeys.leaderboardMatchdays(groupId),
  queryKeys.grandPrix(groupId),
  queryKeys.matchdayFixtures(groupId),
  queryKeys.matchFriendPredictions(groupId),
  queryKeys.matchdayStats(groupId),
  queryKeys.customMatches(groupId),
  queryKeys.customTeams(groupId),
  queryKeys.customLockState(groupId),
  queryKeys.matchSelection(groupId),
];

/**
 * Olvida una liga a la que el usuario ya no pertenece: sus consultas en caché, sus borradores y su
 * marca de última visita. Lo que es de todas sus ligas (sus predicciones, el resumen) se vuelve a pedir.
 */
export function forgetLeague(queryClient: QueryClient, groupId: string | number) {
  const id = String(groupId);
  leagueScopedKeys(id).forEach((queryKey) => queryClient.removeQueries({ queryKey }));
  void queryClient.invalidateQueries({ queryKey: queryKeys.myPredictions() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.predictionScore() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.myLeagueSummaries() });
  clearGroupDrafts(id);
  forgetGroupVisit(id);
}

/**
 * Quita una liga de la lista del usuario en caché, antes de que el servidor la vuelva a enviar. Las
 * de juegos de mesa tienen además su tarjeta en la lista de marcadores, que también se limpia.
 */
export function dropFromMyGroups(queryClient: QueryClient, groupId: string | number) {
  queryClient.setQueryData<Group[]>(queryKeys.myGroups(true), (groups) =>
    groups?.filter((g) => String(g.id) !== String(groupId)),
  );
  queryClient.setQueryData<TrackerSummary[]>(queryKeys.trackers(), (trackers) =>
    trackers?.filter((t) => String(t.id) !== String(groupId)),
  );
}
