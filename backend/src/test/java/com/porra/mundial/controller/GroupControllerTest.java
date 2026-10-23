package com.porra.mundial.controller;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.BetGroup;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.service.GroupService;
import com.porra.mundial.service.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(GroupController.class)
@AutoConfigureMockMvc(addFilters = false)
class GroupControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GroupService groupService;

    @MockBean
    private EditionRepository editionRepository;

    @MockBean
    private WebSocketService webSocketService;

    @MockBean
    private JwtUtil jwtUtil;

    private Principal userPrincipal(String email) {
        return () -> email;
    }

    @Test
    @DisplayName("Miembro del grupo puede ver el joinCode")
    void memberCanSeeJoinCode() throws Exception {
        BetGroup group = BetGroup.builder()
                .id(10L)
                .name("Grupo Amigos")
                .joinCode("SECRET10")
                .adminUser(UserAccount.builder().id(1L).participantName("Admin").build())
                .build();

        Mockito.when(groupService.getGroupById(10L)).thenReturn(Optional.of(group));
        Mockito.when(groupService.isUserMemberOrAdmin(eq(10L), eq("member@test.com"))).thenReturn(true);
        Mockito.when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/groups/10").principal(userPrincipal("member@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.joinCode").value("SECRET10"));
    }

    @Test
    @DisplayName("No miembro NO puede ver el joinCode (recibe null)")
    void nonMemberCannotSeeJoinCode() throws Exception {
        BetGroup group = BetGroup.builder()
                .id(10L)
                .name("Grupo Privado")
                .joinCode("SUPERSECRET")
                .adminUser(UserAccount.builder().id(1L).participantName("Admin").build())
                .build();

        Mockito.when(groupService.getGroupById(10L)).thenReturn(Optional.of(group));
        Mockito.when(groupService.isUserMemberOrAdmin(eq(10L), eq("stranger@test.com"))).thenReturn(false);
        Mockito.when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/groups/10").principal(userPrincipal("stranger@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.joinCode").doesNotExist());
    }

    @Test
    @DisplayName("Detalle del grupo incluye tanto betMode como poolFormat")
    void groupDetailsIncludesBothBetModeAndPoolFormat() throws Exception {
        BetGroup group = BetGroup.builder()
                .id(20L)
                .name("Liga Mundial")
                .joinCode("WC2026")
                .adminUser(UserAccount.builder().id(1L).participantName("Admin").build())
                .build();

        Competition comp = Competition.builder().id(1L).name("Mundial 2026").build();
        Edition edition = Edition.builder()
                .id(5L)
                .league(group)
                .competition(comp)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY)
                .pichichi(true)
                .build();

        Mockito.when(groupService.getGroupById(20L)).thenReturn(Optional.of(group));
        Mockito.when(groupService.isUserMemberOrAdmin(eq(20L), eq("member@test.com"))).thenReturn(true);
        Mockito.when(editionRepository.findByLeagueIdAndStatus(20L, "ACTIVE")).thenReturn(Optional.of(edition));

        mockMvc.perform(get("/api/groups/20").principal(userPrincipal("member@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.betMode").value("KNOCKOUTS_ONLY"))
                .andExpect(jsonPath("$.poolFormat").value("KNOCKOUTS_ONLY"))
                .andExpect(jsonPath("$.competitionName").value("Mundial 2026"));
    }

    @Test
    @DisplayName("Crear grupo con nuevo campo poolFormat es exitoso")
    void createGroupWithPoolFormatField() throws Exception {
        BetGroup createdGroup = BetGroup.builder()
                .id(30L)
                .name("Liga Nueva")
                .joinCode("NUEVA30")
                .adminUser(UserAccount.builder().id(2L).participantName("User2").build())
                .build();

        Mockito.when(groupService.createGroup(eq("Liga Nueva"), eq("user@test.com"), eq(1L), eq(PoolFormat.FULL_BRACKET), eq(true)))
                .thenReturn(createdGroup);

        String json = """
            {
                "name": "Liga Nueva",
                "competitionId": 1,
                "poolFormat": "FULL_BRACKET",
                "pichichi": true
            }
            """;

        mockMvc.perform(post("/api/groups")
                        .principal(userPrincipal("user@test.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(30))
                .andExpect(jsonPath("$.name").value("Liga Nueva"));
    }
}
