package app.porrapp.config;

import app.porrapp.controller.SpaPageController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Los archivos del jar llevan la fecha fija de 1980: si los entrypoints anunciaran
 * Last-Modified, la revalidación del navegador recibiría 304 tras un despliegue y el
 * Service Worker se quedaría en la versión anterior.
 */
@WebMvcTest(SpaPageController.class)
@Import({WebConfig.class, SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class WebConfigCacheTest {

    private static final String JAR_ENTRY_DATE = "Fri, 01 Feb 1980 00:00:00 GMT";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private app.porrapp.repository.UserAccountRepository userAccountRepository;

    @Test
    void serviceWorkerRevalidationAlwaysReturnsTheCurrentScript() throws Exception {
        mockMvc.perform(get("/sw.js").header("If-Modified-Since", JAR_ENTRY_DATE))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Last-Modified"))
                .andExpect(header().string("Cache-Control", "no-cache"));
    }

    @Test
    void indexRevalidationAlwaysReturnsTheCurrentDocument() throws Exception {
        mockMvc.perform(get("/index.html").header("If-Modified-Since", JAR_ENTRY_DATE))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Last-Modified"));
    }

    @Test
    void spaPageRevalidationAlwaysReturnsTheCurrentDocument() throws Exception {
        mockMvc.perform(get("/ranking").header("If-Modified-Since", JAR_ENTRY_DATE))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Last-Modified"));
    }
}
