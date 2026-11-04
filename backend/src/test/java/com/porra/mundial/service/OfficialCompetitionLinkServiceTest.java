package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OfficialCompetitionLinkServiceTest {
    private final EditionRepository editions = mock(EditionRepository.class);
    private final CompetitionRepository competitions = mock(CompetitionRepository.class);
    private final MatchRepository matches = mock(MatchRepository.class);
    private final PredictionRepository predictions = mock(PredictionRepository.class);
    private final OfficialCompetitionLinkService service = new OfficialCompetitionLinkService(
            editions, competitions, matches, predictions, mock(ScoreInvalidationService.class));

    private final League league = League.builder().id(7L)
            .adminUser(UserAccount.builder().googleEmail("admin@test.dev").build()).build();
    private final Competition custom = Competition.builder().id(30L).ownerLeague(league).build();
    private final Competition worlds = Competition.builder().id(19L).externalId("lol.worlds")
            .formatType("TOURNAMENT").build();
    private final LocalDateTime start = LocalDateTime.of(2026, 11, 3, 23, 0);

    private Match match(long id, Competition competition, String round, String home, String away, int day) {
        return Match.builder().id(id).competition(competition).round(round).matchDate(start.plusDays(day))
                .homeTeam(Team.builder().name(home).build()).awayTeam(Team.builder().name(away).build()).build();
    }

    @Test
    void movesLeagueToWorldsAndTranslatesPredictions() {
        // Cuadro personalizado con siglas y otros emparejamientos de semifinales.
        when(matches.findByCompetitionId(30L)).thenReturn(List.of(
                match(1, custom, "bracket-1", "BLG", "DK", 0),
                match(2, custom, "bracket-1", "T1", "KC", 0),
                match(3, custom, "bracket-1", "IG", "TES", 0),
                match(4, custom, "bracket-1", "Gen.G", "LYON", 0)));
        when(matches.findByCompetitionId(19L)).thenReturn(List.of(
                match(767, worlds, "qf", "Invictus Gaming", "TOP ESPORTS", 0),
                match(768, worlds, "qf", "Gen.G Esports", "LYON", 1),
                match(769, worlds, "qf", "Dplus KIA", "BILIBILI GAMING", 2),
                match(770, worlds, "qf", "T1", "Karmine Corp", 3)));
        Edition edition = Edition.builder().id(5L).league(league).competition(custom)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).lockMode(PredictionLockMode.PER_MATCH).build();
        when(editions.findByLeagueIdAndStatus(7L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(editions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(competitions.findById(19L)).thenReturn(Optional.of(worlds));
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(List.of(List.of("BLG", "T1", "IG", "Gen.G"), List.of("T1", "Gen.G"), List.of("Gen.G")));
        data.setChampion("Gen.G");
        Prediction prediction = Prediction.builder().bracketData(data).build();
        when(predictions.findByEditionLeagueId(7L)).thenReturn(List.of(prediction));

        service.link(7L, "admin@test.dev", 19L);

        assertEquals(worlds, edition.getCompetition());
        assertEquals(PredictionLockMode.PER_MATCH, edition.getLockMode());
        assertNull(edition.getLockDate());
        PredictionDataDTO translated = prediction.getBracketData();
        assertEquals(List.of(
                List.of("Invictus Gaming", "Gen.G Esports", "BILIBILI GAMING", "T1"),
                List.of("Gen.G Esports", "T1"),
                List.of("Gen.G Esports")), translated.getCustomRounds());
        assertEquals("Gen.G Esports", translated.getChampion());
        assertNull(translated.getGroups());
    }

    @Test
    void rejectsUnknownTeamsAndNonAdmins() {
        when(matches.findByCompetitionId(30L)).thenReturn(List.of(match(1, custom, "bracket-1", "Foo", "Bar", 0)));
        when(matches.findByCompetitionId(19L)).thenReturn(List.of(match(767, worlds, "qf", "T1", "KC", 0)));
        Edition edition = Edition.builder().league(league).competition(custom)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build();
        when(editions.findByLeagueIdAndStatus(7L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(competitions.findById(19L)).thenReturn(Optional.of(worlds));

        assertThrows(BusinessException.class, () -> service.link(7L, "other@test.dev", 19L));
        assertThrows(BusinessException.class, () -> service.link(7L, "admin@test.dev", 19L));
        assertEquals(custom, edition.getCompetition());
    }
}
