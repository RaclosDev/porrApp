package app.porrapp.controller;

import app.porrapp.config.JwtUtil;
import app.porrapp.dto.AdminOverviewDTO;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.admin.AdminAccess;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
}
