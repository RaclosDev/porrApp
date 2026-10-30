package com.porra.mundial.controller;

import com.porra.mundial.model.League;
import com.porra.mundial.service.GroupService;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JoinPreviewControllerTest {

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
