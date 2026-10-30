package com.porra.mundial.service;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebSocketServiceTest {

    private WebSocketService service;

    @BeforeEach
    void setUp() {
        service = new WebSocketService(new ConcurrentMapCacheManager(), new ObjectMapper());
    }

    private static WebSocketSession openSession(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        return session;
    }

    @Test
    @DisplayName("Las difusiones simultáneas nunca escriben a la vez en la misma sesión")
    void serializesConcurrentSendsToTheSameSession() throws Exception {
        WebSocketSession session = openSession("s1");
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger maxInFlight = new AtomicInteger();
        doAnswer(inv -> {
            maxInFlight.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
            Thread.sleep(20);
            inFlight.decrementAndGet();
            return null;
        }).when(session).sendMessage(any());
        service.addSession(session);

        int broadcasts = 8;
        ExecutorService pool = Executors.newFixedThreadPool(broadcasts);
        CountDownLatch start = new CountDownLatch(1);
        List<java.util.concurrent.Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < broadcasts; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                service.broadcastUpdate("DATA_UPDATED");
                return null;
            }));
        }
        start.countDown();
        for (var future : futures) future.get(5, TimeUnit.SECONDS);
        pool.shutdown();

        assertEquals(1, maxInFlight.get(), "la sesión subyacente no admite envíos concurrentes");
    }

    @Test
    @DisplayName("Responde a una sesión registrada y da de baja las que fallan")
    void sendsToRegisteredSessionsAndDropsBrokenOnes() throws Exception {
        WebSocketSession healthy = openSession("ok");
        WebSocketSession broken = openSession("ko");
        doThrow(new IOException("conexión cortada")).when(broken).sendMessage(any());
        service.addSession(healthy);
        service.addSession(broken);

        service.sendTo(healthy, "{\"type\":\"PONG\"}");
        service.broadcastUpdate("DATA_UPDATED");
        service.broadcastUpdate("DATA_UPDATED");

        verify(healthy, times(3)).sendMessage(any(TextMessage.class));
        verify(broken, times(1)).sendMessage(any(WebSocketMessage.class));
    }

    @Test
    @DisplayName("Una sesión cerrada deja de recibir mensajes")
    void removedSessionsReceiveNothing() throws Exception {
        WebSocketSession session = openSession("s1");
        service.addSession(session);
        service.removeSession(session);

        service.broadcastUpdate("DATA_UPDATED");
        service.sendTo(session, "{}");

        verify(session, never()).sendMessage(any());
    }

    private static String sentPayload(WebSocketSession session) throws IOException {
        var captor = org.mockito.ArgumentCaptor.forClass(WebSocketMessage.class);
        verify(session).sendMessage(captor.capture());
        return (String) captor.getValue().getPayload();
    }

    @Test
    @DisplayName("Un cambio en una liga borra solo sus entradas y avisa con su id")
    void leagueChangeOnlyTouchesThatLeague() throws Exception {
        var caches = new ConcurrentMapCacheManager();
        caches.getCache("leaderboard").put(10L, "ranking 10");
        caches.getCache("leaderboard").put(20L, "ranking 20");
        caches.getCache("groupById").put(10L, "liga 10");
        caches.getCache("competitionStandings").put(4L, "tabla de ESPN");
        caches.getCache("userGroups").put("a@test.com", "mis ligas");
        service = new WebSocketService(caches, new ObjectMapper());
        WebSocketSession session = openSession("s1");
        service.addSession(session);

        service.notifyLeagueChanged(10L);

        assertEquals(null, caches.getCache("leaderboard").get(10L));
        assertEquals("ranking 20", caches.getCache("leaderboard").get(20L).get());
        assertEquals(null, caches.getCache("groupById").get(10L));
        assertEquals("tabla de ESPN", caches.getCache("competitionStandings").get(4L).get(),
                "las clasificaciones de ESPN no dependen de la liga");
        assertEquals(null, caches.getCache("userGroups").get("a@test.com"));
        var message = new ObjectMapper().readTree(sentPayload(session));
        assertEquals("LEAGUE_UPDATED", message.get("type").asString());
        assertEquals(10L, message.get("leagueId").asLong());
    }

    @Test
    @DisplayName("Un cambio de resultados no borra las cachés de las ligas")
    void resultsChangeKeepsLeagueCaches() throws Exception {
        var caches = new ConcurrentMapCacheManager();
        caches.getCache("matches").put("all", "partidos");
        caches.getCache("userGroups").put("a@test.com", "mis ligas");
        caches.getCache("competitions").put("all", "competiciones");
        service = new WebSocketService(caches, new ObjectMapper());
        WebSocketSession session = openSession("s1");
        service.addSession(session);

        service.notifyResultsChanged();

        assertEquals(null, caches.getCache("matches").get("all"));
        assertEquals("mis ligas", caches.getCache("userGroups").get("a@test.com").get());
        assertEquals("competiciones", caches.getCache("competitions").get("all").get());
        assertEquals("DATA_UPDATED", new ObjectMapper().readTree(sentPayload(session)).get("type").asString());
    }

    @Test
    @DisplayName("Un cambio de perfil borra las clasificaciones y las ligas de todos")
    void profileChangeClearsEveryLeague() {
        var caches = new ConcurrentMapCacheManager();
        caches.getCache("leaderboard").put(10L, "ranking 10");
        caches.getCache("leaderboard").put(20L, "ranking 20");
        caches.getCache("matches").put("all", "partidos");
        service = new WebSocketService(caches, new ObjectMapper());

        service.notifyProfileChanged();

        assertEquals(null, caches.getCache("leaderboard").get(10L));
        assertEquals(null, caches.getCache("leaderboard").get(20L));
        assertEquals("partidos", caches.getCache("matches").get("all").get());
    }
}
