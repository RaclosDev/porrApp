package app.porrapp.service.tournament;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.TeamOddsDTO;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.League;
import app.porrapp.repository.CompetitionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupTournamentServiceTest {

    @Mock private CompetitionRepository competitionRepository;
    @Mock private StandingsService standingsService;
    @Mock private OfficialResultsService officialResultsService;
    @Mock private TeamService teamService;
    @Mock private TopScorerService topScorerService;
    @InjectMocks private GroupTournamentService service;

    private final Competition worldCup = Competition.builder().id(2L).name("Mundial")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
    private final Competition laLiga = Competition.builder().id(5L).name("LaLiga").externalId("esp.1").build();

    @Test
    void aRegisteredTournamentIsFoundById() {
        when(competitionRepository.findById(2L)).thenReturn(Optional.of(worldCup));

        assertThat(service.tournament(2L)).isSameAs(worldCup);
    }

    @Test
    void aLeagueOrAnUnknownCompetitionIsNotATournament() {
        when(competitionRepository.findById(5L)).thenReturn(Optional.of(laLiga));
        when(competitionRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.tournament(5L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.tournament(9L)).isInstanceOf(BusinessException.class);
    }

    @Test
    void aCustomCompetitionNeverBorrowsTheFormatOfAnOfficialOne() {
        Competition copy = Competition.builder().id(8L).name("Mi Mundial")
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).ownerLeague(new League()).build();
        when(competitionRepository.findById(8L)).thenReturn(Optional.of(copy));

        assertThatThrownBy(() -> service.tournament(8L)).isInstanceOf(BusinessException.class);
    }

    @Test
    void everyReadIsOfTheTournamentGiven() {
        var points = Map.of("A", Map.of("España", Map.of("pts", 9)));
        var odds = Map.of("E", List.of(new TeamOddsDTO("España", 4.5, 1.2, 7.0)));
        var scorers = List.of(new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 8, "F", "1", "Francia", ""));
        PredictionDataDTO bracket = new PredictionDataDTO();
        when(standingsService.getGroupPoints(worldCup)).thenReturn(points);
        when(officialResultsService.bracket(worldCup)).thenReturn(bracket);
        when(teamService.getGroupOdds(worldCup)).thenReturn(odds);
        when(topScorerService.getTopScorers(worldCup)).thenReturn(scorers);

        assertThat(service.groupPoints(worldCup)).isEqualTo(points);
        assertThat(service.officialBracket(worldCup)).isSameAs(bracket);
        assertThat(service.groupOdds(worldCup)).isEqualTo(odds);
        assertThat(service.scorers(worldCup)).isEqualTo(scorers);
    }
}
