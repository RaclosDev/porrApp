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
        service = newService(new ConcurrentMapCacheManager(), id -> WebSocketService.Audience.EVERYONE);
    }

    /** Sin retraso de agrupación, para que los avisos de liga se envíen en el acto. */
    private static WebSocketService newService(org.springframework.cache.CacheManager caches,
                                               WebSocketService.LeagueAudience audience) {
        WebSocketService created = new WebSocketService(caches, new ObjectMapper(), audience);
        created.leagueNoticeDelayMs = 0;
        return created;
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
        service = newService(caches, id -> WebSocketService.Audience.EVERYONE);
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
        service = newService(caches, id -> WebSocketService.Audience.EVERYONE);
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
        service = newService(caches, id -> WebSocketService.Audience.EVERYONE);

        service.notifyProfileChanged();

        assertEquals(null, caches.getCache("leaderboard").get(10L));
        assertEquals(null, caches.getCache("leaderboard").get(20L));
        assertEquals("partidos", caches.getCache("matches").get("all").get());
    }

    @Test
    @DisplayName("El aviso de una liga privada solo llega a sus miembros identificados")
    void privateLeagueNoticeOnlyReachesMembers() throws Exception {
        service = newService(new ConcurrentMapCacheManager(),
                id -> new WebSocketService.Audience(false, java.util.Set.of(7L)));
        WebSocketSession member = openSession("member");
        WebSocketSession stranger = openSession("stranger");
        WebSocketSession anonymous = openSession("anon");
        service.addSession(member);
        service.addSession(stranger);
        service.addSession(anonymous);
        service.authenticate(member, 7L);
        service.authenticate(stranger, 8L);

        service.notifyLeagueChanged(10L);

        verify(member).sendMessage(any());
        verify(stranger, never()).sendMessage(any());
        verify(anonymous, never()).sendMessage(any());

        service.authenticate(member, null);
        service.notifyLeagueChanged(10L);
        verify(member, times(1)).sendMessage(any());
    }

    @Test
    @DisplayName("Guardar predicciones seguidas en una liga manda un solo aviso y no vacía la lista de ligas")
    void predictionSavesAreCoalescedPerLeague() throws Exception {
        var caches = new ConcurrentMapCacheManager();
        caches.getCache("leaderboard").put(10L, "ranking 10");
        caches.getCache("userGroups").put("a@test.com", "mis ligas");
        service = new WebSocketService(caches, new ObjectMapper(), id -> WebSocketService.Audience.EVERYONE);
        service.leagueNoticeDelayMs = 100;
        WebSocketSession session = openSession("s1");
        CountDownLatch sent = new CountDownLatch(1);
        doAnswer(inv -> { sent.countDown(); return null; }).when(session).sendMessage(any());
        service.addSession(session);

        for (int i = 0; i < 20; i++) service.notifyPredictionsChanged(10L);

        assertEquals(null, caches.getCache("leaderboard").get(10L), "la clasificación se borra en el acto");
        assertEquals("mis ligas", caches.getCache("userGroups").get("a@test.com").get());
        assertEquals(true, sent.await(5, TimeUnit.SECONDS));
        Thread.sleep(300);
        verify(session, times(1)).sendMessage(any());
        service.shutdown();
    }

    @Test
    @DisplayName("Si solo avanza el minuto de juego, se borran los partidos pero no las clasificaciones")
    void clockChangeKeepsStandings() throws Exception {
        var caches = new ConcurrentMapCacheManager();
        caches.getCache("matches").put("all", "partidos");
        caches.getCache("standings").put("all", "tabla");
        caches.getCache("leaderboard").put(10L, "ranking 10");
        service = newService(caches, id -> WebSocketService.Audience.EVERYONE);
        WebSocketSession session = openSession("s1");
        service.addSession(session);

        service.notifyClockChanged();

        assertEquals(null, caches.getCache("matches").get("all"));
        assertEquals("tabla", caches.getCache("standings").get("all").get());
        assertEquals("ranking 10", caches.getCache("leaderboard").get(10L).get());
        assertEquals("CLOCK_UPDATED", new ObjectMapper().readTree(sentPayload(session)).get("type").asString());
    }

    @Test
    @DisplayName("Una IP no puede abrir más conexiones que el tope; al cerrar una, deja hueco")
    void capsConnectionsPerIp() throws Exception {
        service.maxConnectionsPerIp = 2;
        WebSocketSession first = sessionFromIp("a", "1.2.3.4");
        WebSocketSession second = sessionFromIp("b", "1.2.3.4");
        WebSocketSession third = sessionFromIp("c", "1.2.3.4");
        WebSocketSession otherIp = sessionFromIp("d", "5.6.7.8");

        assertEquals(true, service.addSession(first));
        assertEquals(true, service.addSession(second));
        assertEquals(false, service.addSession(third));
        assertEquals(true, service.addSession(otherIp));
        verify(third).close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION);

        service.removeSession(first);
        assertEquals(true, service.addSession(sessionFromIp("e", "1.2.3.4")));
    }

    private static WebSocketSession sessionFromIp(String id, String ip) {
        WebSocketSession session = openSession(id);
        java.util.Map<String, Object> attributes = new java.util.HashMap<>();
        attributes.put(WebSocketService.CLIENT_IP_ATTRIBUTE, ip);
        when(session.getAttributes()).thenReturn(attributes);
        return session;
    }
}
