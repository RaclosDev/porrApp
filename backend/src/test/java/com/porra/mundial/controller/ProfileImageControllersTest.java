package com.porra.mundial.controller;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.model.League;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.ProfileImageService;
import com.porra.mundial.service.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({LeagueImageController.class, UserProfileController.class})
@AutoConfigureMockMvc(addFilters = false)
class ProfileImageControllersTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired private MockMvc mockMvc;

    @MockitoBean private ProfileImageService profileImageService;
    @MockitoBean private WebSocketService webSocketService;
    @MockitoBean private JwtUtil jwtUtil;

    private Principal user(String email) {
        return () -> email;
    }

    private MockMultipartFile file() {
        return new MockMultipartFile("file", "logo.png", "image/png", new byte[]{1, 2, 3});
    }

    @Test
    @DisplayName("PUT /api/groups/{id}/image devuelve la nueva URL cuando el servicio acepta la subida")
    void uploadLeagueImage() throws Exception {
        League league = League.builder().id(10L).imageUpdatedAt(Instant.now())
                .imageKey("0123456789abcdef0123456789abcdef").build();
        Mockito.when(profileImageService.saveLeagueImage(eq(10L), eq("admin@test.com"), any())).thenReturn(league);

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/groups/10/image").file(file())
                        .principal(user("admin@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl").value(org.hamcrest.Matchers.matchesPattern("/api/groups/10/image/[0-9a-f]{32}")));
        Mockito.verify(webSocketService).notifyLeagueChanged(10L);
    }

    @Test
    @DisplayName("Subida de imagen de liga por quien no es admin responde 403")
    void uploadLeagueImageForbidden() throws Exception {
        Mockito.when(profileImageService.saveLeagueImage(eq(10L), eq("other@test.com"), any()))
                .thenThrow(BusinessException.forbidden("Solo el administrador de la liga puede cambiar su imagen."));

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/groups/10/image").file(file())
                        .principal(user("other@test.com")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @DisplayName("Una imagen inválida responde 400 con mensaje")
    void uploadInvalidImage() throws Exception {
        Mockito.when(profileImageService.saveLeagueImage(eq(10L), any(), any()))
                .thenThrow(BusinessException.badRequest("Formato no admitido. Usa una imagen JPG o PNG."));

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/groups/10/image").file(file())
                        .principal(user("admin@test.com")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Formato no admitido. Usa una imagen JPG o PNG."));
    }

    @Test
    @DisplayName("GET de imagen de liga: 404 si no hay imagen y 200 con tipo y caché si existe")
    void getLeagueImage() throws Exception {
        Mockito.when(profileImageService.getLeagueImage(1L, "k1")).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/groups/1/image/k1")).andExpect(status().isNotFound());

        Mockito.when(profileImageService.getLeagueImage(2L, "k2")).thenReturn(Optional.of(
                new ProfileImageService.StoredImage(new byte[]{1, 2, 3}, "image/png", Instant.now())));
        mockMvc.perform(get("/api/groups/2/image/k2"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().exists("ETag"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("max-age")));
    }

    @Test
    @DisplayName("DELETE de imagen de liga delega en el servicio con el email del token")
    void deleteLeagueImage() throws Exception {
        Mockito.when(profileImageService.deleteLeagueImage(10L, "admin@test.com"))
                .thenReturn(League.builder().id(10L).build());

        mockMvc.perform(delete("/api/groups/10/image").principal(user("admin@test.com")))
                .andExpect(status().isOk());
        Mockito.verify(profileImageService).deleteLeagueImage(10L, "admin@test.com");
    }

    @Test
    @DisplayName("PUT /api/users/me/profile cambia solo el nombre del usuario del token")
    void updateProfile() throws Exception {
        UserAccount updated = UserAccount.builder().id(2L).googleEmail("other@test.com")
                .participantName("Nuevo").build();
        Mockito.when(profileImageService.updateParticipantName("other@test.com", "Nuevo")).thenReturn(updated);

        mockMvc.perform(put("/api/users/me/profile").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participantName\":\"Nuevo\"}")
                        .principal(user("other@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participantName").value("Nuevo"));
    }

    @Test
    @DisplayName("Nombre duplicado responde 409 y nombre vacío 400")
    void updateProfileErrors() throws Exception {
        Mockito.when(profileImageService.updateParticipantName(any(), eq("Repetido")))
                .thenThrow(BusinessException.conflict("Ese nombre ya está en uso. Elige otro."));

        mockMvc.perform(put("/api/users/me/profile").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participantName\":\"Repetido\"}").principal(user("other@test.com")))
                .andExpect(status().isConflict());
        mockMvc.perform(put("/api/users/me/profile").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participantName\":\"  \"}").principal(user("other@test.com")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Subir y borrar la foto de perfil usa siempre el email del token")
    void avatarUploadAndDelete() throws Exception {
        UserAccount withAvatar = UserAccount.builder().id(2L).participantName("Otro")
                .avatarUpdatedAt(Instant.now()).avatarKey("0123456789abcdef0123456789abcdef").build();
        Mockito.when(profileImageService.saveAvatar(eq("other@test.com"), any())).thenReturn(withAvatar);
        Mockito.when(profileImageService.deleteAvatar("other@test.com"))
                .thenReturn(UserAccount.builder().id(2L).participantName("Otro").build());

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/users/me/avatar").file(file())
                        .principal(user("other@test.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.matchesPattern("/api/users/2/avatar/[0-9a-f]{32}")));
        mockMvc.perform(delete("/api/users/me/avatar").principal(user("other@test.com")))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET de la foto de perfil: 404 sin foto y 200 con imagen")
    void getAvatar() throws Exception {
        Mockito.when(profileImageService.getAvatar(5L, "k5")).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/users/5/avatar/k5")).andExpect(status().isNotFound());

        Mockito.when(profileImageService.getAvatar(6L, "k6")).thenReturn(Optional.of(
                new ProfileImageService.StoredImage(new byte[]{9}, "image/jpeg", Instant.now())));
        mockMvc.perform(get("/api/users/6/avatar/k6"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG));
    }
}
