import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Group, Match } from '../types/api';
import { queryKeys } from '../services/queryKeys';
import { getAuthToken } from '../services/api';

/** Consultas que cambian cuando cambia un resultado. */
const SCORE_DEPENDENT_KEYS = [
  queryKeys.radar(),
  queryKeys.tournamentStandings(),
  queryKeys.leaderboard(),
  queryKeys.leaderboardMatchdays(),
  queryKeys.matchdayFixtures(),
  queryKeys.matchFriendPredictions(),
  queryKeys.matchdayStats(),
  queryKeys.competitionStandings(),
  queryKeys.tournamentOfficialBracket(),
  queryKeys.predictionScore(),
  // Fórmula 1: los Grandes Premios se cargan en segundo plano y los resultados llegan con la sincronización.
  queryKeys.grandPrix(),
];

const DATA_DEPENDENT_KEYS = [
  ...SCORE_DEPENDENT_KEYS,
  queryKeys.predictions(),
  queryKeys.matches(),
  queryKeys.tournamentTopScorers(),
];

const RECONNECT_KEYS = [
  ...DATA_DEPENDENT_KEYS,
  queryKeys.tournamentGroupOdds(),
  queryKeys.group(),
  queryKeys.groupMembers(),
  queryKeys.leagueScoring(),
  queryKeys.myPredictions(),
  queryKeys.myGroups(),
  queryKeys.scorerPick(),
];

/** Consultas que cambian cuando avanza solo el minuto de juego. */
const CLOCK_KEYS = [queryKeys.matches(), queryKeys.radar()];

/**
 * Retraso aleatorio máximo antes de volver a pedir datos tras un aviso: reparte en el tiempo
 * las peticiones de todos los clientes conectados en vez de lanzarlas a la vez.
 */
export const INVALIDATION_JITTER_MS = 2000;
const INVALIDATION_BASE_DELAY_MS = 100;

/** Consultas de una liga concreta: solo se vuelven a pedir si están en pantalla. */
const leagueKeys = (leagueId: string | number, isMine: boolean) => [
  queryKeys.group(leagueId),
  queryKeys.groupMembers(leagueId),
  queryKeys.leagueScoring(leagueId),
  queryKeys.predictions(leagueId),
  queryKeys.leaderboard(leagueId),
  queryKeys.leaderboardMatchdays(leagueId),
  queryKeys.matchdayFixtures(leagueId),
  queryKeys.matchFriendPredictions(leagueId),
  queryKeys.matchdayStats(leagueId),
  queryKeys.scorerPick(leagueId),
  // Están en pantalla en casi todas las vistas: solo se piden si la liga es mía, para que
  // el aviso de una liga pública no haga recargar a todos los conectados.
  ...(isMine
    ? [
        // El aviso no dice de quién es el cambio: puede ser la porra propia (o su borrado).
        queryKeys.myPredictions(),
        queryKeys.predictionScore(),
        // Las tarjetas de "Mis ligas" muestran miembros e imagen.
        queryKeys.myGroups(),
      ]
    : []),
];

const isMyLeague = (queryClient: QueryClient, leagueId: string | number) =>
  queryClient
    .getQueriesData<Group[]>({ queryKey: queryKeys.myGroups() })
    .some(
      ([, groups]) =>
        Array.isArray(groups) && groups.some((group) => String(group?.id) === String(leagueId)),
    );

/** Competiciones de las ligas que este cliente tiene cargadas: las suyas y la que esté viendo. */
const followedCompetitionIds = (queryClient: QueryClient) => {
  const ids = new Set<number>();
  const add = (group: Group | null | undefined) => {
    if (!group || typeof group !== 'object') return;
    if (group.competitionId != null) ids.add(Number(group.competitionId));
    group.competitions?.forEach((competition) => ids.add(Number(competition.id)));
  };
  queryClient.getQueriesData<Group[]>({ queryKey: queryKeys.myGroups() }).forEach(([, groups]) => {
    if (Array.isArray(groups)) groups.forEach(add);
  });
  queryClient.getQueriesData<Group>({ queryKey: queryKeys.group() }).forEach(([, group]) => {
    if (!Array.isArray(group)) add(group);
  });
  return ids;
};

/**
 * Competiciones de un aviso que este cliente no sigue en ninguna liga, o `null` si el aviso le toca.
 * Un aviso sin competiciones es general, y sin ligas cargadas no se puede saber: los dos se dan por propios.
 */
const foreignCompetitions = (queryClient: QueryClient, competitionIds: unknown) => {
  if (!Array.isArray(competitionIds) || competitionIds.length === 0) return null;
  const ids = competitionIds.map(Number);
  const followed = followedCompetitionIds(queryClient);
  if (followed.size === 0 || ids.some((id) => followed.has(id))) return null;
  return ids;
};

const invalidateAll = (queryClient: QueryClient, keys: readonly (readonly unknown[])[]) => {
  keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
};

export function useWebSocket(queryClient: QueryClient) {
  useEffect(() => {
    const loc = window.location;
    const wsUrl = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + '/api/ws';
    let ws: WebSocket | null = null;
    let wsPingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let invalidationTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingInvalidations = new Map<string, readonly unknown[]>();
    let disconnected = false;
    let disposed = false;

    const queueInvalidations = (keys: readonly (readonly unknown[])[]) => {
      keys.forEach((key) => pendingInvalidations.set(JSON.stringify(key), key));
      if (invalidationTimer !== null) return;
      invalidationTimer = setTimeout(
        () => {
          invalidationTimer = null;
          invalidateAll(queryClient, [...pendingInvalidations.values()]);
          pendingInvalidations.clear();
        },
        INVALIDATION_BASE_DELAY_MS + Math.floor(Math.random() * INVALIDATION_JITTER_MS),
      );
    };

    const connectWebSocket = () => {
      if (disposed) return;
      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.onopen = () => {
        if (disposed || socket !== ws) return;
        if (disconnected) {
          if (invalidationTimer !== null) clearTimeout(invalidationTimer);
          invalidationTimer = null;
          pendingInvalidations.clear();
          invalidateAll(queryClient, RECONNECT_KEYS);
          disconnected = false;
        }
        // Los avisos de una liga privada solo llegan a sus miembros: el servidor necesita
        // saber quién está conectado. Se reenvía si el token cambia (refresco, login o logout).
        let sentToken = getAuthToken();
        socket.send(JSON.stringify({ type: 'AUTH', token: sentToken }));
        wsPingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            const token = getAuthToken();
            if (token !== sentToken) {
              sentToken = token;
              socket.send(JSON.stringify({ type: 'AUTH', token }));
            }
            socket.send(JSON.stringify({ type: 'PING' }));
          }
        }, 10000);
      };

      socket.onmessage = (event) => {
        if (disposed || socket !== ws) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'DATA_UPDATED') {
            // El resultado de una competición que no juega ninguna de mis ligas no cambia nada de
            // lo mío: solo se refrescan las vistas de esa competición, si alguna está en pantalla.
            const foreign = foreignCompetitions(queryClient, msg.competitionIds);
            queueInvalidations(
              foreign
                ? foreign.flatMap((id) => [
                    queryKeys.matches(id),
                    queryKeys.radar(id),
                    queryKeys.competitionStandings(id),
                  ])
                : DATA_DEPENDENT_KEYS,
            );
          } else if (msg.type === 'CLOCK_UPDATED') {
            const foreign = foreignCompetitions(queryClient, msg.competitionIds);
            queueInvalidations(
              foreign
                ? foreign.flatMap((id) => [queryKeys.matches(id), queryKeys.radar(id)])
                : CLOCK_KEYS,
            );
          } else if (msg.type === 'LEAGUE_UPDATED') {
            if (msg.leagueId != null) {
              queueInvalidations(leagueKeys(msg.leagueId, isMyLeague(queryClient, msg.leagueId)));
            }
          } else if (msg.type === 'MATCH_SCORE_UPDATED') {
            if (msg.matchId) {
              queryClient.setQueriesData(
                { queryKey: queryKeys.matches() },
                (oldMatches: Match[] | undefined) => {
                  if (!Array.isArray(oldMatches)) return oldMatches;
                  return oldMatches.map((m) =>
                    m.id === msg.matchId
                      ? {
                          ...m,
                          homeScore: msg.homeScore,
                          awayScore: msg.awayScore,
                          home_score: msg.homeScore,
                          away_score: msg.awayScore,
                          finished: msg.status === 'FINISHED',
                          status: msg.status,
                        }
                      : m,
                  );
                },
              );
            }
            queueInvalidations(SCORE_DEPENDENT_KEYS);
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      socket.onclose = () => {
        if (disposed || socket !== ws) return;
        disconnected = true;
        if (wsPingInterval) clearInterval(wsPingInterval);
        if (!disposed) reconnectTimer = setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (invalidationTimer !== null) clearTimeout(invalidationTimer);
      pendingInvalidations.clear();
      if (ws) {
        ws.onclose = null;
        ws.onopen = null;
        ws.onmessage = null;
        ws.close();
      }
      if (wsPingInterval) clearInterval(wsPingInterval);
    };
  }, [queryClient]);
}
