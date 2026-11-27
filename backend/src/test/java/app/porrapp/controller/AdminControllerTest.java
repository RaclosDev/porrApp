package app.porrapp.controller;

import app.porrapp.config.JwtUtil;
import app.porrapp.dto.AdminAnnouncementRequest;
import app.porrapp.dto.AdminAnnouncementResult;
import app.porrapp.dto.AdminIncidentDTO;
import app.porrapp.dto.AdminOverviewDTO;
import app.porrapp.service.admin.AdminAnnouncementService;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.admin.AdminAccess;
import app.porrapp.service.admin.AdminIncidentService;
import app.porrapp.service.admin.AdminService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminAccess access;

    @MockitoBean
    private AdminService service;

    @MockitoBean
    private AdminAnnouncementService announcements;

    @MockitoBean
    private AdminIncidentService incidents;

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @MockitoBean
    private JwtUtil jwtUtil;

    private static final Principal BOSS = () -> "boss@example.com";

    @Test
    void adminGetsTheOverviewWithoutCaching() throws Exception {
        var totals = new AdminOverviewDTO.Totals(3, 1, 2, 3, 1, 2, 4, 1, 1, 9, Map.of("POOL", 4L));
        Mockito.when(service.overview()).thenReturn(
                new AdminOverviewDTO(Instant.now(), totals, List.of(), List.of(), List.of()));

        mockMvc.perform(get("/api/admin/overview").principal(BOSS))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.totals.users").value(3))
                .andExpect(jsonPath("$.totals.leaguesByKind.POOL").value(4));
        Mockito.verify(access).requireAdmin("boss@example.com");
    }

    @Test
    void nonAdminGetsNotFoundAndNothingIsComputed() throws Exception {
        Mockito.doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND)).when(access).requireAdmin("boss@example.com");

        mockMvc.perform(get("/api/admin/overview").principal(BOSS)).andExpect(status().isNotFound());
        Mockito.verifyNoInteractions(service);
    }

    @Test
    void adminSendsAnAnnouncementAndGetsTheDeliveryCounts() throws Exception {
        Mockito.when(announcements.send(eq("boss@example.com"), any()))
                .thenReturn(new AdminAnnouncementResult(2, 7, 9, 7, 1, 1));

        mockMvc.perform(post("/api/admin/announcements").principal(BOSS)
                        .contentType("application/json")
                        .content("{\"leagueIds\":[1,2],\"title\":\"Hola\",\"body\":\"Novedades\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.devices").value(9))
                .andExpect(jsonPath("$.sent").value(7))
                .andExpect(jsonPath("$.failed").value(1));
        Mockito.verify(access).requireAdmin("boss@example.com");
        Mockito.verify(announcements).send("boss@example.com",
                new AdminAnnouncementRequest(List.of(1L, 2L), "Hola", "Novedades"));
    }

    private static AdminIncidentDTO incident(String status) {
        return new AdminIncidentDTO(5L, "SCORE_CHANGE", status, 10L, "España - Uruguay", "Mundial", Instant.now(),
                new AdminIncidentDTO.Side("Finalizado", 2, 1, null), new AdminIncidentDTO.Side("Finalizado", 2, 2, null),
                Instant.now(), Instant.now(), 1, null, null, null);
    }

    @Test
    void adminListsAndResolvesTheHeldResults() throws Exception {
        Mockito.when(incidents.list()).thenReturn(List.of(incident("PENDING")));
        Mockito.when(incidents.apply(5L)).thenReturn(incident("APPLIED"));
        Mockito.when(incidents.dismiss(5L)).thenReturn(incident("DISMISSED"));

        mockMvc.perform(get("/api/admin/incidents").principal(BOSS))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$[0].received.awayScore").value(2));
        mockMvc.perform(post("/api/admin/incidents/5/apply").principal(BOSS))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPLIED"));
        mockMvc.perform(post("/api/admin/incidents/5/dismiss").principal(BOSS))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DISMISSED"));
        Mockito.verify(access, Mockito.times(3)).requireAdmin("boss@example.com");
    }

    @Test
    void nonAdminCannotSeeOrResolveIncidents() throws Exception {
        Mockito.doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND)).when(access).requireAdmin("boss@example.com");

        mockMvc.perform(get("/api/admin/incidents").principal(BOSS)).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/admin/incidents/5/apply").principal(BOSS)).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/admin/incidents/5/dismiss").principal(BOSS)).andExpect(status().isNotFound());
        Mockito.verifyNoInteractions(incidents);
    }

    @Test
    void nonAdminCannotSendAnnouncements() throws Exception {
        Mockito.doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND)).when(access).requireAdmin("boss@example.com");

        mockMvc.perform(post("/api/admin/announcements").principal(BOSS)
                        .contentType("application/json")
                        .content("{\"leagueIds\":[1],\"title\":\"Hola\",\"body\":\"Texto\"}"))
                .andExpect(status().isNotFound());
        Mockito.verifyNoInteractions(announcements);
    }
}
