package com.porra.mundial.controller;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.dto.LeagueResponseDTO;
import com.porra.mundial.dto.LeagueSummaryDTO;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.league.LeagueService;
import com.porra.mundial.service.league.NewLeague;
import com.porra.mundial.service.league.LeagueSetup;
import com.porra.mundial.service.league.LeagueSetupService;
import com.porra.mundial.service.league.LeagueSummaryService;
import com.porra.mundial.service.notification.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LeagueController.class)
@AutoConfigureMockMvc(addFilters = false)
class LeagueControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LeagueService leagueService;

    @MockitoBean
    private com.porra.mundial.service.league.LeagueMembershipService membershipService;

    @MockitoBean
    private WebSocketService webSocketService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private LeagueSummaryService leagueSummaryService;

    @MockitoBean
    private LeagueSetupService leagueSetupService;

    private Principal userPrincipal(String email) {
        return () -> email;
    }

    @Test
    @DisplayName("El detalle del grupo se pide con el email de quien lo consulta")
    void groupDetailsUseViewerEmail() throws Exception {
        Mockito.when(leagueService.findLeagueResponse(10L, "member@test.com"))
                .thenReturn(Optional.of(LeagueResponseDTO.builder().id(10L).name("Grupo Amigos").joinCode("AMIGOS").build()));

        mockMvc.perform(get("/api/groups/10").principal(userPrincipal("member@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Grupo Amigos"))
                .andExpect(jsonPath("$.joinCode").value("AMIGOS"));
    }

    @Test
    @DisplayName("El resumen de mis ligas se pide con el email de la sesión")
    void leagueSummariesUseSessionEmail() throws Exception {
        Mockito.when(leagueSummaryService.summaries("member@test.com"))
                .thenReturn(List.of(new LeagueSummaryDTO(10L, 2, 40, 5, 3)));

        mockMvc.perform(get("/api/groups/mine/summary").principal(userPrincipal("member@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].groupId").value(10))
                .andExpect(jsonPath("$[0].rank").value(2))
                .andExpect(jsonPath("$[0].pendingPredictions").value(3));
    }

    @Test
    @DisplayName("Un grupo inexistente devuelve 404 con mensaje de error")
    void unknownGroupReturnsNotFound() throws Exception {
        Mockito.when(leagueService.findLeagueResponse(99L, null)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/groups/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Grupo no encontrado"));
    }

    @Test
    @DisplayName("Crear un grupo devuelve el DTO con poolFormat y código de invitación")
    void createGroupReturnsDto() throws Exception {
        League createdGroup = League.builder()
                .id(30L)
                .name("Liga Nueva")
                .joinCode("NUEVA30")
                .adminUser(UserAccount.builder().id(2L).participantName("User2").build())
                .build();
        Mockito.when(leagueSetupService.create(new NewLeague("Liga Nueva", "user@test.com", 1L, PoolFormat.FULL_BRACKET, true, null, null), LeagueSetup.NONE))
                .thenReturn(createdGroup);
        Mockito.when(leagueService.toResponse(createdGroup, true))
                .thenReturn(LeagueResponseDTO.builder().id(30L).name("Liga Nueva").joinCode("NUEVA30").poolFormat("FULL_BRACKET").build());

        String json = """
            {"name": "Liga Nueva", "competitionId": 1, "poolFormat": "FULL_BRACKET", "pichichi": true}
            """;

        mockMvc.perform(post("/api/groups")
                        .principal(userPrincipal("user@test.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(30))
                .andExpect(jsonPath("$.joinCode").value("NUEVA30"))
                .andExpect(jsonPath("$.poolFormat").value("FULL_BRACKET"));
    }

    @Test
    @DisplayName("Los ajustes que llegan al crear (normas, cuota, puntuación y cierre) pasan a la creación")
    void createGroupPassesSetup() throws Exception {
        League createdGroup = League.builder().id(32L).name("Liga Nueva").joinCode("NUEVA32").build();
        LeagueSetup expected = new LeagueSetup("Bizum a Ana", true,
                com.porra.mundial.scoring.ScoringRuleSet.builder().correctSignPoints(4).build(),
                com.porra.mundial.model.PredictionLockMode.FIXED_DATE, null,
                java.time.Instant.parse("2026-12-01T19:00:00Z"));
        Mockito.when(leagueSetupService.create(new NewLeague("Liga Nueva", "user@test.com", 1L, PoolFormat.MATCH_DAY, false, null, null), expected))
                .thenReturn(createdGroup);
        Mockito.when(leagueService.toResponse(createdGroup, true))
                .thenReturn(LeagueResponseDTO.builder().id(32L).name("Liga Nueva").joinCode("NUEVA32").build());

        String json = """
            {"name": "Liga Nueva", "competitionId": 1, "poolFormat": "MATCH_DAY", "pichichi": false,
             "rules": "Bizum a Ana", "entryFee": true, "scoring": {"correctSignPoints": 4},
             "lockMode": "FIXED_DATE", "lockDate": "2026-12-01T20:00:00"}
            """;

        mockMvc.perform(post("/api/groups")
                        .principal(userPrincipal("user@test.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(32));
    }

    @Test
    @DisplayName("Una puntuación no válida al crear se rechaza sin crear la liga")
    void createGroupRejectsInvalidScoring() throws Exception {
        mockMvc.perform(post("/api/groups")
                        .principal(userPrincipal("user@test.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Liga\", \"competitionId\": 1, \"poolFormat\": \"MATCH_DAY\", \"scoring\": {\"correctSignPoints\": -1}}"))
                .andExpect(status().isBadRequest());
        Mockito.verifyNoInteractions(leagueSetupService);
    }

    @Test
    @DisplayName("Si la misma clave de idempotencia choca con el índice único se devuelve la liga ya creada")
    void createGroupWithConcurrentKeyReturnsExistingLeague() throws Exception {
        League existing = League.builder().id(31L).name("Liga Nueva").joinCode("NUEVA31").build();
        String key = "0b6f1c1e-6a3c-4d4e-9a55-7b1f2d3c4e5f";
        Mockito.when(leagueSetupService.create(new NewLeague("Liga Nueva", "user@test.com", 1L, PoolFormat.FULL_BRACKET, true, null, key), LeagueSetup.NONE))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("uq_leagues_admin_creation_key"));
        Mockito.when(leagueService.findCreatedWithKey("user@test.com", key)).thenReturn(java.util.Optional.of(existing));
        Mockito.when(leagueService.toResponse(existing, true))
                .thenReturn(LeagueResponseDTO.builder().id(31L).name("Liga Nueva").joinCode("NUEVA31").build());

        mockMvc.perform(post("/api/groups")
                        .principal(userPrincipal("user@test.com"))
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Liga Nueva\", \"competitionId\": 1, \"poolFormat\": \"FULL_BRACKET\", \"pichichi\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(31));
    }

    @Test
    @DisplayName("Una Idempotency-Key con formato extraño se rechaza")
    void createGroupRejectsMalformedKey() throws Exception {
        mockMvc.perform(post("/api/groups")
                        .principal(userPrincipal("user@test.com"))
                        .header("Idempotency-Key", "x")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Liga\", \"competitionId\": 1, \"poolFormat\": \"FULL_BRACKET\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Crear un grupo sin poolFormat es un error de validación")
    void createGroupRequiresPoolFormat() throws Exception {
        mockMvc.perform(post("/api/groups")
                        .principal(userPrincipal("user@test.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Liga\", \"competitionId\": 1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("El estado de pago solo admite PAID o PENDING")
    void memberPaymentRejectsUnknownStatus() throws Exception {
        mockMvc.perform(put("/api/groups/10/members/2/payment")
                        .principal(userPrincipal("admin@test.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"MAYBE\"}"))
                .andExpect(status().isBadRequest());
    }
}
