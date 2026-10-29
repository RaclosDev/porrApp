package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.filter.ForwardedHeaderFilter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class RateLimitingFilterTest {

    private RateLimitingFilter rateLimitingFilter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        rateLimitingFilter = new RateLimitingFilter();
        ReflectionTestUtils.setField(rateLimitingFilter, "enabled", true);
        ReflectionTestUtils.setField(rateLimitingFilter, "maxRequestsPerMinute", 5);
        filterChain = mock(FilterChain.class);
    }

    @Test
    @DisplayName("Peticiones dentro del límite son procesadas normalmente")
    void allowsRequestsWithinLimit() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/standings");
        request.setRemoteAddr("192.168.1.10");
        MockHttpServletResponse response = new MockHttpServletResponse();

        rateLimitingFilter.doFilterInternal(request, response, filterChain);

        assertEquals(200, response.getStatus());
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    @DisplayName("Peticiones que superan el límite reciben HTTP 429 Too Many Requests")
    void blocksRequestsExceedingLimit() throws Exception {
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/predictions");
            req.setRemoteAddr("10.0.0.1");
            MockHttpServletResponse res = new MockHttpServletResponse();
            rateLimitingFilter.doFilterInternal(req, res, filterChain);
            assertEquals(200, res.getStatus());
        }

        MockHttpServletRequest blockedReq = new MockHttpServletRequest("GET", "/api/predictions");
        blockedReq.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse blockedRes = new MockHttpServletResponse();

        rateLimitingFilter.doFilterInternal(blockedReq, blockedRes, filterChain);

        assertEquals(429, blockedRes.getStatus());
        assertEquals("60", blockedRes.getHeader("Retry-After"));
        verify(filterChain, times(5)).doFilter(any(), any());
    }

    @Test
    @DisplayName("Rutas no limitadas pasan libremente sin restricción")
    void nonRateLimitedPathsBypassCheck() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
        request.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse response = new MockHttpServletResponse();

        rateLimitingFilter.doFilterInternal(request, response, filterChain);

        assertEquals(200, response.getStatus());
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @ParameterizedTest
    @CsvSource({
            "GET, /api/groups/preview/ABCDEF",
            "GET, /join/ABCDEF",
            "GET, /join/ABCDEF/image.png",
            "POST, /api/groups/join"
    })
    @DisplayName("Las rutas de invitación también tienen límite, para no probar códigos por fuerza bruta")
    void invitationPathsAreRateLimited(String method, String path) throws Exception {
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest(method, path);
            req.setRemoteAddr("10.0.0.3");
            MockHttpServletResponse res = new MockHttpServletResponse();
            rateLimitingFilter.doFilterInternal(req, res, filterChain);
            assertEquals(200, res.getStatus());
        }

        MockHttpServletRequest blocked = new MockHttpServletRequest(method, path);
        blocked.setRemoteAddr("10.0.0.3");
        MockHttpServletResponse blockedRes = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(blocked, blockedRes, filterChain);

        assertEquals(429, blockedRes.getStatus());
    }

    private MockHttpServletRequest proxied(String forwardedFor) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/predictions");
        req.setRemoteAddr("100.64.0.2"); // proxy de Railway
        req.addHeader("X-Forwarded-For", forwardedFor);
        return req;
    }

    @Test
    @DisplayName("La IP es el último salto de X-Forwarded-For; CF-Connecting-IP y X-Real-IP se ignoran")
    void usesLastForwardedHopAndIgnoresClientHeaders() {
        MockHttpServletRequest req = proxied("6.6.6.6, 203.0.113.7");
        req.addHeader("CF-Connecting-IP", "7.7.7.7");
        req.addHeader("X-Real-IP", "8.8.8.8");

        assertEquals("203.0.113.7", rateLimitingFilter.getClientIp(req));
    }

    @Test
    @DisplayName("Sin X-Forwarded-For se usa la dirección de la conexión")
    void fallsBackToRemoteAddr() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/predictions");
        req.setRemoteAddr("192.0.2.1");

        assertEquals("192.0.2.1", rateLimitingFilter.getClientIp(req));
    }

    @Test
    @DisplayName("Con dos proxies de confianza se toma el penúltimo salto")
    void honoursConfiguredProxyHops() {
        ReflectionTestUtils.setField(rateLimitingFilter, "trustedProxyHops", 2);

        assertEquals("203.0.113.7", rateLimitingFilter.getClientIp(proxied("6.6.6.6, 203.0.113.7, 172.70.1.1")));
    }

    @Test
    @DisplayName("Cambiar la IP falsa del principio de X-Forwarded-For no salta el límite, ni detrás de ForwardedHeaderFilter")
    void spoofedForwardedForDoesNotBypassLimit() throws Exception {
        ForwardedHeaderFilter forwarded = new ForwardedHeaderFilter();
        FilterChain throughLimiter = (r, s) -> rateLimitingFilter.doFilter(r, s, filterChain);

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = proxied("10.9.9." + i + ", 203.0.113.7");
            req.addHeader("CF-Connecting-IP", "10.8.8." + i);
            MockHttpServletResponse res = new MockHttpServletResponse();
            forwarded.doFilter(req, res, throughLimiter);
            assertEquals(200, res.getStatus());
        }

        MockHttpServletResponse blocked = new MockHttpServletResponse();
        forwarded.doFilter(proxied("10.9.9.99, 203.0.113.7"), blocked, throughLimiter);

        assertEquals(429, blocked.getStatus());
    }

    @Test
    @DisplayName("El mapa de contadores no pasa del tope de IPs")
    void counterMapIsBounded() throws Exception {
        ReflectionTestUtils.setField(rateLimitingFilter, "maxTrackedClients", 50);

        for (int i = 0; i < 500; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/standings");
            req.setRemoteAddr("198.51." + (i / 250) + "." + (i % 250));
            rateLimitingFilter.doFilterInternal(req, new MockHttpServletResponse(), filterChain);
            assertTrue(rateLimitingFilter.trackedClients() <= 50);
        }
    }
}
