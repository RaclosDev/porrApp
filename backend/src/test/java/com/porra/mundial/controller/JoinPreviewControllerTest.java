package com.porra.mundial.controller;

import com.porra.mundial.model.League;
import com.porra.mundial.service.GroupService;
import com.porra.mundial.service.InvitationImageRenderer;
import com.porra.mundial.service.ProfileImageService;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.awt.Color;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JoinPreviewControllerTest {

    // Uno por test: la caché de imágenes no se comparte entre pruebas.
    private final InvitationImageRenderer renderer = new InvitationImageRenderer("https://porra.raclos.es");

    @Test
    void invitationUsesVersionedPaperArtworkAndMatchingMetadata() throws Exception {
        GroupService groupService = mock(GroupService.class);
        League league = League.builder().id(5L).name("La peña de Raclos").joinCode("ABCDEFGH23").build();
        when(groupService.getGroupByJoinCode("ABCDEFGH23")).thenReturn(Optional.of(league));
        when(groupService.findActiveEdition(anyLong())).thenReturn(Optional.empty());
        JoinPreviewController controller = new JoinPreviewController(groupService, mock(ProfileImageService.class), renderer);

        String html = controller.preview("ABCDEFGH23");
        assertThat(html).contains("image.png?v=3", "property=\"og:image:width\" content=\"1200\"",
                "property=\"og:image:height\" content=\"630\"");

        byte[] png = controller.invitationImage("ABCDEFGH23");
        var image = ImageIO.read(new ByteArrayInputStream(png));
        assertThat(image.getWidth()).isEqualTo(1200);
        assertThat(image.getHeight()).isEqualTo(630);
        assertThat(new Color(image.getRGB(0, 0), true)).isEqualTo(new Color(15, 23, 42));
        assertThat(new Color(image.getRGB(1100, 420), true)).isEqualTo(new Color(243, 236, 220));
        Files.createDirectories(Path.of("target", "invitation-preview"));
        Files.write(Path.of("target", "invitation-preview", "paper.png"), png);
    }

    @Test
    void invitationImagesAreDrawnOnceUntilTheLeagueChanges() throws Exception {
        GroupService groupService = mock(GroupService.class);
        ProfileImageService images = mock(ProfileImageService.class);
        League league = League.builder().id(6L).name("Amigos").joinCode("ABCDEFGH24").build();
        when(groupService.getGroupByJoinCode("ABCDEFGH24")).thenReturn(Optional.of(league));
        when(groupService.findActiveEdition(anyLong())).thenReturn(Optional.empty());
        when(images.getLeagueImage(6L)).thenReturn(Optional.empty());
        JoinPreviewController controller = new JoinPreviewController(groupService, images, renderer);

        byte[] first = controller.invitationImage("ABCDEFGH24");
        assertThat(controller.invitationImage("ABCDEFGH24")).isSameAs(first);
        verify(images, times(1)).getLeagueImage(6L);

        league.setName("Amigos 2026");
        assertThat(controller.invitationImage("ABCDEFGH24")).isNotSameAs(first);
        verify(images, times(2)).getLeagueImage(6L);
    }

    @Test
    void leagueNamesWithRegexReplacementCharactersAreWrittenLiterally() throws Exception {
        GroupService groupService = mock(GroupService.class);
        League league = League.builder().id(5L).name("Liga $1 \\ <b>").joinCode("ABCDEFGH23").build();
        when(groupService.getGroupByJoinCode("ABCDEFGH23")).thenReturn(Optional.of(league));
        when(groupService.findActiveEdition(anyLong())).thenReturn(Optional.empty());

        String html = new JoinPreviewController(groupService, mock(ProfileImageService.class), renderer).preview("abcdefgh23");

        assertThat(html).contains("<title>Liga $1 \\ &lt;b&gt;</title>");
        assertThat(html).contains("content=\"Liga $1 \\ &lt;b&gt;\"");
    }
    @Test
    void invitationRendersTheImageStoredInThisInstallation() throws Exception {
        GroupService groups = mock(GroupService.class);
        ProfileImageService images = mock(ProfileImageService.class);
        when(groups.getGroupByJoinCode("LOCAL")).thenReturn(Optional.of(
                League.builder().id(5L).name("Local").joinCode("LOCAL").build()));
        var photo = new java.awt.image.BufferedImage(8, 8, java.awt.image.BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < 8; x++) for (int y = 0; y < 8; y++) photo.setRGB(x, y, Color.MAGENTA.getRGB());
        var bytes = new java.io.ByteArrayOutputStream();
        ImageIO.write(photo, "png", bytes);
        when(images.getLeagueImage(5L)).thenReturn(Optional.of(
                new ProfileImageService.StoredImage(bytes.toByteArray(), "image/png", null)));

        var rendered = ImageIO.read(new ByteArrayInputStream(
                new JoinPreviewController(groups, images, renderer).invitationImage("LOCAL")));

        assertThat(new Color(rendered.getRGB(190, 280))).isEqualTo(Color.MAGENTA);
        org.mockito.Mockito.verify(images).getLeagueImage(5L);
    }

}
