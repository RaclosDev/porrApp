package com.porra.mundial.controller;

import com.porra.mundial.config.CanonicalHostFilter;
import com.porra.mundial.config.CsrfOriginFilter;
import com.porra.mundial.config.JwtAuthFilter;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.config.RateLimitingFilter;
import com.porra.mundial.config.SecurityConfig;
import com.porra.mundial.config.WebConfig;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lo que ve un buscador: las páginas públicas responden 200 indexables, las pantallas de la app
 * llevan noindex y una dirección inventada da 404 en vez de copiar la portada.
 */
@WebMvcTest(SpaPageController.class)
@Import({WebConfig.class, SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class,
        CsrfOriginFilter.class, CanonicalHostFilter.class, GlobalExceptionHandler.class})
class SpaPageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Test
    void everyPublicPageIsServedAndIndexable() throws Exception {
        for (String path : SpaPageController.INDEXABLE) {
            mockMvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(header().doesNotExist("X-Robots-Tag"))
                    .andExpect(header().string("Content-Language", "es"))
                    .andExpect(header().string("Cache-Control", "no-cache"))
                    .andExpect(content().contentType("text/html;charset=UTF-8"));
        }
    }

    @Test
    void everyAppScreenIsServedButKeptOutOfSearch() throws Exception {
        for (String path : SpaPageController.APP) {
            mockMvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-Robots-Tag", "noindex"));
        }
    }

    @Test
    void prerenderedPageIsServedInsteadOfTheCommonShell() throws Exception {
        mockMvc.perform(get("/porra-laliga"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<h1>Porra de LaLiga</h1>")));
    }

    @Test
    void unknownPageReturnsRealNotFoundWithTheAppShell() throws Exception {
        mockMvc.perform(get("/no-existe"))
                .andExpect(status().isNotFound())
                .andExpect(header().string("X-Robots-Tag", "noindex"))
                .andExpect(content().string(containsString("<html")));
    }

    @Test
    void trailingSlashRedirectsToTheCanonicalPage() throws Exception {
        mockMvc.perform(get("/privacidad/").queryParam("utm_source", "x"))
                .andExpect(status().isMovedPermanently())
                .andExpect(header().string("Location", "/privacidad?utm_source=x"));
    }

    @Test
    void missingAssetAndApiKeepJsonNotFound() throws Exception {
        mockMvc.perform(get("/no-existe.png"))
                .andExpect(status().isNotFound())
                .andExpect(content().string(containsString("\"error\"")));
    }

    @Test
    void manifestIsServedWithItsOwnMediaType() throws Exception {
        mockMvc.perform(get("/manifest.webmanifest"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/manifest+json"));
    }

    @Test
    void wwwRedirectsToTheBareDomain() throws Exception {
        mockMvc.perform(get("/porra-laliga").queryParam("a", "1").with(request -> {
                    request.setServerName("www.porrapp.app");
                    return request;
                }))
                .andExpect(status().isMovedPermanently())
                .andExpect(header().string("Location", "https://porrapp.app/porra-laliga?a=1"));
    }
}
