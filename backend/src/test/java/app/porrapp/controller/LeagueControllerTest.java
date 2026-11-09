package app.porrapp.controller;

import app.porrapp.config.JwtUtil;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.dto.LeagueResponseDTO;
import app.porrapp.dto.LeagueSummaryDTO;
import app.porrapp.model.League;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.UserAccount;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.league.LeagueSetup;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.LeagueSummaryService;
import app.porrapp.service.notification.WebSocketService;
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
    private app.porrapp.service.league.LeagueMembershipService membershipService;

    @MockitoBean
    private WebSocketService webSocketService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private LeagueSummaryService leagueSummaryService;

    @MockitoBean
    private LeagueSetupService leagueSetupService;

    @MockitoBean
    private app.porrapp.service.league.LeagueRepeatService leagueRepeatService;

    @Test
    @DisplayName("Repetir una liga devuelve la de la temporada nueva y avisa a quien mira la terminada")
    void repeatReturnsTheNewLeague() throws Exception {
        League repeated = League.builder().id(41L).name("Grupo Amigos").joinCode("NUEVA41").build();
        Mockito.when(leagueRepeatService.repeat(10L, "admin@test.com")).thenReturn(repeated);
        Mockito.when(leagueService.toResponse(repeated, true))
                .thenReturn(LeagueResponseDTO.builder().id(41L).name("Grupo Amigos").season("2026/27").build());

        mockMvc.perform(post("/api/groups/10/repeat").principal(userPrincipal("admin@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(41))
                .andExpect(jsonPath("$.season").value("2026/27"));
        Mockito.verify(webSocketService).notifyLeagueChanged(10L);
    }

    @Test
    @DisplayName("Quien no administra la liga no la repite ni avisa a nadie")
    void repeatByANonAdminIsForbidden() throws Exception {
        Mockito.when(leagueRepeatService.repeat(10L, "member@test.com"))
                .thenThrow(app.porrapp.exception.BusinessException.forbidden("No tienes permiso para administrar esta liga."));

        mockMvc.perform(post("/api/groups/10/repeat").principal(userPrincipal("member@test.com")))
                .andExpect(status().isForbidden());
        Mockito.verify(webSocketService, Mockito.never()).notifyLeagueChanged(10L);
    }

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
                .thenReturn(List.of(new LeagueSummaryDTO(10L, 2, 40, 5, 3, true)));

        mockMvc.perform(get("/api/groups/mine/summary").principal(userPrincipal("member@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].groupId").value(10))
                .andExpect(jsonPath("$[0].rank").value(2))
                .andExpect(jsonPath("$[0].pendingPredictions").value(3))
                .andExpect(jsonPath("$[0].finished").value(true));
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
                app.porrapp.scoring.ScoringRuleSet.builder().correctSignPoints(4).build(),
                app.porrapp.model.PredictionLockMode.FIXED_DATE, null,
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
