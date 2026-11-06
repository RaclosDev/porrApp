package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class RequestBodyLimitFilterTest {

    private final RequestBodyLimitFilter filter = new RequestBodyLimitFilter();

    private static MockHttpServletRequest post(String path, byte[] body) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setContentType("application/json");
        request.setContent(body);
        return request;
    }

    @Test
    @DisplayName("Un cuerpo dentro del límite pasa sin cambios")
    void allowsBodyWithinLimit() throws Exception {
        MockHttpServletRequest request = post("/api/predictions", new byte[1024]);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertEquals(200, response.getStatus());
    }

    @Test
    @DisplayName("Un Content-Length por encima del límite responde 413 sin llegar al controlador")
    void rejectsDeclaredOversizedBody() throws Exception {
        MockHttpServletRequest request = post("/api/predictions", new byte[RequestBodyLimitFilter.MAX_BODY_BYTES + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(any(), any());
        assertEquals(413, response.getStatus());
    }

    @Test
    @DisplayName("Los informes de errores del navegador tienen un límite más bajo")
    void clientErrorsHaveLowerLimit() throws Exception {
        MockHttpServletRequest request = post("/api/client-errors", new byte[RequestBodyLimitFilter.MAX_CLIENT_ERROR_BYTES + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(any(), any());
        assertEquals(413, response.getStatus());
    }

    @Test
    @DisplayName("Sin Content-Length la lectura se corta al pasar el límite")
    void cutsChunkedBodyAtLimit() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/client-errors") {
            @Override
            public long getContentLengthLong() {
                return -1;
            }
        };
        request.setContentType("application/json");
        request.setContent(new byte[RequestBodyLimitFilter.MAX_CLIENT_ERROR_BYTES + 100]);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        ArgumentCaptor<HttpServletRequest> passed = ArgumentCaptor.forClass(HttpServletRequest.class);
        verify(chain).doFilter(passed.capture(), any());
        InputStream body = passed.getValue().getInputStream();
        assertThrows(RequestBodyLimitFilter.BodyTooLargeException.class, body::readAllBytes);
    }

    @Test
    @DisplayName("Las subidas multipart quedan fuera: tienen sus propios límites")
    void skipsMultipart() throws Exception {
        MockHttpServletRequest request = post("/api/users/me/avatar", new byte[RequestBodyLimitFilter.MAX_BODY_BYTES + 1]);
        request.setContentType("multipart/form-data; boundary=x");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }
}
