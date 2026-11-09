package app.porrapp.controller;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.TeamOddsDTO;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.model.Competition;
import app.porrapp.service.tournament.GroupTournamentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Rutas antiguas de los datos oficiales del Mundial, de cuando era el único torneo con grupos. Sirven lo
 * mismo que {@link TournamentController} para la competición del Mundial, mientras la aplicación web no
 * pida los del torneo de cada liga.
 */
@RestController
@RequestMapping("/api/world-cup")
@RequiredArgsConstructor
public class WorldCupController {

    private final GroupTournamentService tournaments;

    @GetMapping("/standings")
    public Map<String, Map<String, Map<String, Integer>>> getStandings() {
        return worldCup().map(tournaments::groupPoints).orElseGet(Map::of);
    }

    @GetMapping("/official-bracket")
    public PredictionDataDTO getOfficialBracket() {
        return worldCup().map(tournaments::officialBracket).orElseGet(PredictionDataDTO::new);
    }

    @GetMapping("/group-odds")
    public Map<String, List<TeamOddsDTO>> getGroupOdds() {
        return worldCup().map(tournaments::groupOdds).orElseGet(Map::of);
    }

    @GetMapping("/scorers")
    public List<TopScorerDTO> getTopScorers() {
        return worldCup().map(tournaments::scorers).orElseGet(List::of);
    }

    private Optional<Competition> worldCup() {
        return tournaments.tournament(Competition.WORLD_CUP_EXTERNAL_ID);
    }
}
