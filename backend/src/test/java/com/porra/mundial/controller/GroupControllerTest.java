package com.porra.mundial.controller;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.dto.GroupResponseDTO;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.GroupService;
import com.porra.mundial.service.WebSocketService;
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

@WebMvcTest(GroupController.class)
@AutoConfigureMockMvc(addFilters = false)
class GroupControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GroupService groupService;

    @MockitoBean
    private WebSocketService webSocketService;

    @MockitoBean
    private JwtUtil jwtUtil;

    private Principal userPrincipal(String email) {
        return () -> email;
    }

    @Test
    @DisplayName("El detalle del grupo se pide con el email de quien lo consulta")
    void groupDetailsUseViewerEmail() throws Exception {
        Mockito.when(groupService.findGroupResponse(10L, "member@test.com"))
                .thenReturn(Optional.of(GroupResponseDTO.builder().id(10L).name("Grupo Amigos").joinCode("AMIGOS").build()));

        mockMvc.perform(get("/api/groups/10").principal(userPrincipal("member@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Grupo Amigos"))
                .andExpect(jsonPath("$.joinCode").value("AMIGOS"));
    }

    @Test
    @DisplayName("Un grupo inexistente devuelve 404 con mensaje de error")
    void unknownGroupReturnsNotFound() throws Exception {
        Mockito.when(groupService.findGroupResponse(99L, null)).thenReturn(Optional.empty());

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
        Mockito.when(groupService.createGroup(eq("Liga Nueva"), eq("user@test.com"), eq(1L), eq(PoolFormat.FULL_BRACKET), eq(true)))
                .thenReturn(createdGroup);
        Mockito.when(groupService.toResponse(createdGroup, true))
                .thenReturn(GroupResponseDTO.builder().id(30L).name("Liga Nueva").joinCode("NUEVA30").poolFormat("FULL_BRACKET").build());

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
