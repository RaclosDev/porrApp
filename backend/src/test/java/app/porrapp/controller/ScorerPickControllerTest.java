package app.porrapp.controller;

import app.porrapp.config.JwtUtil;
import app.porrapp.dto.ScorerCandidateDTO;
import app.porrapp.dto.ScorerPickDTO;
import app.porrapp.dto.ScorerPickStateDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.ScorerPickService;
import app.porrapp.service.notification.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ScorerPickController.class)
@AutoConfigureMockMvc(addFilters = false)
class ScorerPickControllerTest {

    private static final Principal ANA = () -> "ana@test.com";
    private static final Principal ADMIN = () -> "admin@test.com";

    @Autowired private MockMvc mockMvc;
    @MockitoBean private ScorerPickService scorerPickService;
    @MockitoBean private LeagueService leagueService;
    @MockitoBean private WebSocketService webSocketService;
    @MockitoBean private UserAccountRepository userAccountRepository;
    @MockitoBean private JwtUtil jwtUtil;

    private static ScorerPickDTO pick(String status, String playerName) {
        return new ScorerPickDTO(30L, 2L, "Ana", "Ramos", status, playerName == null ? null : "p-goncalo", playerName,
                playerName == null ? "" : "Paris Saint-Germain", false, playerName == null,
                playerName != null ? List.of()
                        : List.of(new ScorerCandidateDTO("p-goncalo", "Gonçalo Ramos", "G. Ramos", "Paris Saint-Germain", "F", 3)));
    }

    @Test
    @DisplayName("El estado del pichichi se lee sin sesión si la liga se puede ver")
    void readsTheStateWithoutLogin() throws Exception {
        when(scorerPickService.state(10L, null)).thenReturn(new ScorerPickStateDTO(true, false, false,
                Instant.parse("2026-08-15T19:00:00Z"), null, false));

        mockMvc.perform(get("/api/groups/10/scorer-pick"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.inBracket").value(false))
                .andExpect(jsonPath("$.locked").value(false))
                .andExpect(jsonPath("$.lockAt").value("2026-08-15T19:00:00Z"));
        verify(leagueService).assertCanView(10L, null);
    }

    @Test
    @DisplayName("Quien no puede ver la liga no ve ni guarda su pichichi")
    void outsidersGetForbidden() throws Exception {
        doThrow(BusinessException.forbidden("No perteneces a esta liga privada"))
                .when(leagueService).assertCanView(10L, "ana@test.com");

        mockMvc.perform(get("/api/groups/10/scorer-picks").principal(ANA)).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/groups/10/scorer-pick").principal(ANA)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Mbappé\"}"))
                .andExpect(status().isForbidden());
        verify(scorerPickService, never()).save(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Se guarda lo escrito o el jugador elegido, y un nombre desmesurado no entra")
    void savesThePick() throws Exception {
        when(scorerPickService.save(10L, "ana@test.com", "Ramos", null)).thenReturn(new ScorerPickStateDTO(true, false,
                false, null, pick(ScorerPickDTO.DOUBTFUL, null), false));

        mockMvc.perform(put("/api/groups/10/scorer-pick").principal(ANA)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Ramos\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mine.status").value("DOUBTFUL"))
                .andExpect(jsonPath("$.mine.writtenName").value("Ramos"))
                .andExpect(jsonPath("$.mine.candidates[0].name").value("Gonçalo Ramos"));

        mockMvc.perform(put("/api/groups/10/scorer-pick").principal(ANA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + "x".repeat(121) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("El administrador asigna un pichichi dudoso y se avisa a quien esté viendo la liga")
    void theAdminAssignsAPick() throws Exception {
        when(scorerPickService.picks(10L, "admin@test.com")).thenReturn(List.of(pick(ScorerPickDTO.DOUBTFUL, null)));
        when(scorerPickService.assign(10L, 30L, "p-goncalo", "admin@test.com"))
                .thenReturn(pick(ScorerPickDTO.PLAYER, "Gonçalo Ramos"));

        mockMvc.perform(get("/api/groups/10/scorer-picks").principal(ADMIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].canAssign").value(true));
        mockMvc.perform(put("/api/groups/10/scorer-picks/30").principal(ADMIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"playerId\": \"p-goncalo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PLAYER"))
                .andExpect(jsonPath("$.playerName").value("Gonçalo Ramos"));
        verify(webSocketService).notifyLeagueChanged(10L);
    }

    @Test
    @DisplayName("Si no es el administrador, no se asigna ni se avisa a nadie")
    void othersCannotAssign() throws Exception {
        when(scorerPickService.assign(10L, 30L, "p-goncalo", "ana@test.com"))
                .thenThrow(BusinessException.forbidden("Solo el administrador de la liga puede asignar un pichichi dudoso."));

        mockMvc.perform(put("/api/groups/10/scorer-picks/30").principal(ANA)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"playerId\": \"p-goncalo\"}"))
                .andExpect(status().isForbidden());
        verify(webSocketService, never()).notifyLeagueChanged(any());
    }
}
