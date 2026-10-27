package com.porra.mundial.service;

import com.porra.mundial.model.League;
import com.porra.mundial.model.LeagueImage;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.UserAvatar;
import com.porra.mundial.repository.LeagueImageRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.repository.UserAvatarRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfileImageServiceTest {

    @Mock private LeagueRepository leagueRepository;
    @Mock private LeagueImageRepository leagueImageRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private UserAvatarRepository userAvatarRepository;

    @InjectMocks private ProfileImageService service;

    private UserAccount admin;
    private UserAccount other;
    private League league;

    @BeforeEach
    void setUp() {
        admin = UserAccount.builder().id(1L).googleEmail("admin@test.com").googleName("Admin G")
                .participantName("Lider").build();
        other = UserAccount.builder().id(2L).googleEmail("other@test.com").googleName("Other G")
                .participantName("Otro").build();
        league = League.builder().id(10L).name("Peña").joinCode("ABC123").adminUser(admin).build();
    }

    private static byte[] png() throws Exception {
        BufferedImage img = new BufferedImage(40, 40, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    // ---- Ligas

    @Test
    @DisplayName("El administrador puede subir la imagen de su liga")
    void adminCanSaveLeagueImage() throws Exception {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueRepository.save(any(League.class))).thenAnswer(i -> i.getArgument(0));

        League saved = service.saveLeagueImage(10L, "ADMIN@test.com", png());

        assertNotNull(saved.getImageUpdatedAt());
        assertTrue(saved.getImageUrl().startsWith("/api/groups/10/image?v="));
        ArgumentCaptor<LeagueImage> captor = ArgumentCaptor.forClass(LeagueImage.class);
        verify(leagueImageRepository).save(captor.capture());
        assertEquals(10L, captor.getValue().getLeagueId());
        assertEquals("image/png", captor.getValue().getContentType());
    }

    @Test
    @DisplayName("Un usuario que no es administrador no puede cambiar ni borrar la imagen de la liga")
    void nonAdminCannotChangeLeagueImage() throws Exception {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        byte[] data = png();

        assertThrows(SecurityException.class, () -> service.saveLeagueImage(10L, "other@test.com", data));
        assertThrows(SecurityException.class, () -> service.deleteLeagueImage(10L, "other@test.com"));
        assertThrows(SecurityException.class, () -> service.saveLeagueImage(10L, null, data));

        verify(leagueImageRepository, never()).save(any());
        verify(leagueImageRepository, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("Liga inexistente devuelve NoSuchElementException")
    void leagueNotFound() {
        when(leagueRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(NoSuchElementException.class, () -> service.saveLeagueImage(99L, "admin@test.com", new byte[]{1}));
    }

    @Test
    @DisplayName("No se guarda nada si el archivo no es una imagen válida")
    void invalidImageIsNotPersisted() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(IllegalArgumentException.class,
                () -> service.saveLeagueImage(10L, "admin@test.com", "no soy una imagen".getBytes()));

        verify(leagueImageRepository, never()).save(any());
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("Borrar la imagen elimina la fila y limpia la marca de versión")
    void adminCanDeleteLeagueImage() {
        league.setImageUpdatedAt(java.time.LocalDateTime.now());
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueImageRepository.existsById(10L)).thenReturn(true);
        when(leagueRepository.save(any(League.class))).thenAnswer(i -> i.getArgument(0));

        League result = service.deleteLeagueImage(10L, "admin@test.com");

        verify(leagueImageRepository).deleteById(10L);
        assertNull(result.getImageUpdatedAt());
        assertNull(result.getImageUrl());
    }

    // ---- Perfil

    @Test
    @DisplayName("La foto de perfil se guarda siempre sobre el usuario del token")
    void avatarIsSavedForAuthenticatedUser() throws Exception {
        when(userAccountRepository.findByGoogleEmail("other@test.com")).thenReturn(Optional.of(other));
        when(userAccountRepository.save(any(UserAccount.class))).thenAnswer(i -> i.getArgument(0));

        UserAccount saved = service.saveAvatar("other@test.com", png());

        ArgumentCaptor<UserAvatar> captor = ArgumentCaptor.forClass(UserAvatar.class);
        verify(userAvatarRepository).save(captor.capture());
        assertEquals(2L, captor.getValue().getUserId());
        assertTrue(saved.getAvatarUrl().startsWith("/api/users/2/avatar?v="));
        verify(userAccountRepository, never()).findByGoogleEmail("admin@test.com");
    }

    @Test
    @DisplayName("Cambiar el nombre público no toca el email ni el nombre de Google")
    void renameKeepsGoogleIdentity() {
        when(userAccountRepository.findByGoogleEmail("other@test.com")).thenReturn(Optional.of(other));
        when(userAccountRepository.existsByParticipantNameIgnoreCaseAndIdNot("Nuevo Nombre", 2L)).thenReturn(false);
        when(userAccountRepository.save(any(UserAccount.class))).thenAnswer(i -> i.getArgument(0));

        UserAccount result = service.updateParticipantName("other@test.com", "  Nuevo   Nombre ");

        assertEquals("Nuevo Nombre", result.getParticipantName());
        assertEquals("other@test.com", result.getGoogleEmail());
        assertEquals("Other G", result.getGoogleName());
    }

    @Test
    @DisplayName("Un nombre ya usado por otra persona se rechaza con conflicto")
    void renameRejectsDuplicates() {
        when(userAccountRepository.findByGoogleEmail("other@test.com")).thenReturn(Optional.of(other));
        when(userAccountRepository.existsByParticipantNameIgnoreCaseAndIdNot("lider", 2L)).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> service.updateParticipantName("other@test.com", "lider"));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    @DisplayName("Valida longitud, caracteres y nombre reservado")
    void renameValidation() {
        assertThrows(IllegalArgumentException.class, () -> ProfileImageService.normalizeParticipantName("a"));
        assertThrows(IllegalArgumentException.class,
                () -> ProfileImageService.normalizeParticipantName("x".repeat(31)));
        assertThrows(IllegalArgumentException.class,
                () -> ProfileImageService.normalizeParticipantName("<b>hola</b>"));
        assertThrows(IllegalArgumentException.class, () -> ProfileImageService.normalizeParticipantName("AdMiN"));
        assertThrows(IllegalArgumentException.class, () -> ProfileImageService.normalizeParticipantName("   "));
        assertEquals("José Núñez-2", ProfileImageService.normalizeParticipantName(" José   Núñez-2 "));
    }

    @Test
    @DisplayName("Sin email autenticado no se puede modificar ningún perfil")
    void requiresAuthenticatedEmail() {
        assertThrows(SecurityException.class, () -> service.updateParticipantName(null, "Nombre"));
        assertThrows(SecurityException.class, () -> service.deleteAvatar(" "));
        verify(userAccountRepository, never()).findByGoogleEmail(anyString());
    }
}
