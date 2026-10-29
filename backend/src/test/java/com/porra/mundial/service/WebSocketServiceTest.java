package com.porra.mundial.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
}
