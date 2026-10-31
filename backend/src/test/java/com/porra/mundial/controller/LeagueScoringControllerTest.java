package com.porra.mundial.controller;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.dto.LeagueScoringDTO;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.service.LeagueScoringService;
import com.porra.mundial.service.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LeagueScoringController.class)
@AutoConfigureMockMvc(addFilters = false)
class LeagueScoringControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LeagueScoringService leagueScoringService;

    @MockitoBean
    private WebSocketService webSocketService;

    @MockitoBean
    private JwtUtil jwtUtil;

    private static final Principal ADMIN = () -> "admin@test.com";

    private static LeagueScoringDTO scoring(ScoringRuleSet rules, boolean editable) {
        return new LeagueScoringDTO("FULL_BRACKET", true, editable, ScoringRuleSet.MAX_POINTS, rules,
                ScoringRuleSet.defaultWorldCup2026());
    }

    private void putScoring(Principal principal, String body, int expectedStatus) throws Exception {
        mockMvc.perform(put("/api/groups/10/scoring").principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    @DisplayName("La puntuación se lee sin sesión: el servicio decide si la liga es visible")
    void readsTheScoringWithoutLogin() throws Exception {
        when(leagueScoringService.getScoring(1L, null)).thenReturn(scoring(ScoringRuleSet.defaultWorldCup2026(), false));

        mockMvc.perform(get("/api/groups/1/scoring"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.poolFormat").value("FULL_BRACKET"))
                .andExpect(jsonPath("$.pichichi").value(true))
                .andExpect(jsonPath("$.matchSignOnly").value(true))
                .andExpect(jsonPath("$.editable").value(false))
                .andExpect(jsonPath("$.maxPoints").value(1000))
                .andExpect(jsonPath("$.rules.championPoints").value(200))
                .andExpect(jsonPath("$.defaults.roundOf32Points").value(25));
    }

    @Test
    void outsidersGetForbidden() throws Exception {
        when(leagueScoringService.getScoring(10L, "intruso@test.com"))
                .thenThrow(new SecurityException("No perteneces a esta liga privada"));

        mockMvc.perform(get("/api/groups/10/scoring").principal(() -> "intruso@test.com"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No perteneces a esta liga privada"));
    }

    @Test
    @DisplayName("El administrador cambia la puntuación y se avisa a quien esté viendo la liga")
    void adminUpdatesTheScoring() throws Exception {
        ScoringRuleSet updated = ScoringRuleSet.builder().championPoints(300).build();
        when(leagueScoringService.updateScoring(eq(10L), any(), eq("admin@test.com"))).thenReturn(scoring(updated, true));

        // Las reglas que no se envían conservan su valor por defecto.
        mockMvc.perform(put("/api/groups/10/scoring").principal(ADMIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"championPoints\":300}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rules.championPoints").value(300))
                .andExpect(jsonPath("$.editable").value(true));

        ArgumentCaptor<ScoringRuleSet> sent = ArgumentCaptor.forClass(ScoringRuleSet.class);
        verify(leagueScoringService).updateScoring(eq(10L), sent.capture(), eq("admin@test.com"));
        assertEquals(updated, sent.getValue());
        verify(webSocketService).notifyLeagueChanged(10L);
    }

    @Test
    void nonAdminsGetForbiddenAndNothingIsBroadcast() throws Exception {
        when(leagueScoringService.updateScoring(eq(10L), any(), eq("member@test.com")))
                .thenThrow(new SecurityException("Solo el administrador de la liga puede cambiar la puntuación."));

        putScoring(() -> "member@test.com", "{\"championPoints\":300}", 403);

        verifyNoInteractions(webSocketService);
    }

    @Test
    void outOfRangeRulesAreABadRequest() throws Exception {
        mockMvc.perform(put("/api/groups/10/scoring").principal(ADMIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"championPoints\":-5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("La regla championPoints vale -5: tiene que estar entre 0 y 1000 puntos."));

        verifyNoInteractions(leagueScoringService, webSocketService);
    }

    @Test
    @DisplayName("Un valor que no es un número entero no llega al servicio")
    void nonIntegerValuesAreRejected() throws Exception {
        putScoring(ADMIN, "{\"championPoints\":\"muchos\"}", 400);
        putScoring(ADMIN, "{\"championPoints\":2.5}", 400);
        putScoring(ADMIN, "{\"championPoints\":null}", 400);
        putScoring(ADMIN, "{\"championPoints\":99999999999}", 400);
        putScoring(ADMIN, "[]", 400);

        verifyNoInteractions(leagueScoringService, webSocketService);
    }
}
