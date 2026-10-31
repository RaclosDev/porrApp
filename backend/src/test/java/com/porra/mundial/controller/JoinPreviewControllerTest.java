package com.porra.mundial.controller;

import com.porra.mundial.model.League;
import com.porra.mundial.service.GroupService;
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
import static org.mockito.Mockito.when;

class JoinPreviewControllerTest {

    @Test
    void invitationUsesVersionedPaperArtworkAndMatchingMetadata() throws Exception {
        GroupService groupService = mock(GroupService.class);
        League league = League.builder().id(5L).name("La peña de Raclos").joinCode("ABCDEFGH23").build();
        when(groupService.getGroupByJoinCode("ABCDEFGH23")).thenReturn(Optional.of(league));
        when(groupService.findActiveEdition(anyLong())).thenReturn(Optional.empty());
        JoinPreviewController controller = new JoinPreviewController(groupService);

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
    void leagueNamesWithRegexReplacementCharactersAreWrittenLiterally() throws Exception {
        GroupService groupService = mock(GroupService.class);
        League league = League.builder().id(5L).name("Liga $1 \\ <b>").joinCode("ABCDEFGH23").build();
        when(groupService.getGroupByJoinCode("ABCDEFGH23")).thenReturn(Optional.of(league));
        when(groupService.findActiveEdition(anyLong())).thenReturn(Optional.empty());

        String html = new JoinPreviewController(groupService).preview("abcdefgh23");

        assertThat(html).contains("<title>Liga $1 \\ &lt;b&gt;</title>");
        assertThat(html).contains("content=\"Liga $1 \\ &lt;b&gt;\"");
    }
}
