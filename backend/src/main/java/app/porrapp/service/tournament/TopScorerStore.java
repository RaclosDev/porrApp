package app.porrapp.service.tournament;

import app.porrapp.dto.TopScorerDTO;
import app.porrapp.model.TopScorer;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.TopScorerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Goleadores guardados de cada competición. La lista guardada es la que puntúa el pichichi: sobrevive a
 * los reinicios y, con el torneo cerrado, ya no depende de que el proveedor lo siga sirviendo.
 */
@Component
@RequiredArgsConstructor
public class TopScorerStore {

    private static final int MAX_TEXT = 255;
    private static final int MAX_URL = 2048;

    private final TopScorerRepository topScorerRepository;
    private final CompetitionRepository competitionRepository;

    /** Goleadores guardados de la competición con ese id externo, en su orden; vacío si no hay ninguno. */
    @Transactional(readOnly = true)
    public List<TopScorerDTO> load(String competitionExternalId) {
        return competitionRepository.findIdByExternalId(competitionExternalId)
                .map(topScorerRepository::findByCompetitionIdOrderByPositionAsc)
                .orElse(List.of())
                .stream()
                .map(row -> new TopScorerDTO(row.getName(), row.getShortName(), row.getGoals(),
                        row.getPlayerPosition(), row.getPlayerId(), row.getTeam(), row.getImageUrl()))
                .toList();
    }

    /** Sustituye la lista guardada de la competición por esta, en el mismo orden. */
    @Transactional
    public void replace(String competitionExternalId, List<TopScorerDTO> scorers) {
        Long competitionId = competitionRepository.findIdByExternalId(competitionExternalId).orElse(null);
        if (competitionId == null) return;
        topScorerRepository.deleteByCompetitionId(competitionId);
        List<TopScorer> rows = new ArrayList<>();
        for (int position = 0; position < scorers.size(); position++) {
            TopScorerDTO scorer = scorers.get(position);
            rows.add(TopScorer.builder()
                    .competitionId(competitionId)
                    .position(position)
                    .name(fit(scorer.name(), MAX_TEXT))
                    .shortName(fit(scorer.shortName(), MAX_TEXT))
                    .goals(scorer.goals())
                    .playerPosition(fit(scorer.position(), MAX_TEXT))
                    .playerId(fit(scorer.playerId(), MAX_TEXT))
                    .team(fit(scorer.team(), MAX_TEXT))
                    // Una URL cortada no sirve: mejor sin foto.
                    .imageUrl(scorer.imageUrl() == null || scorer.imageUrl().length() > MAX_URL ? "" : scorer.imageUrl())
                    .build());
        }
        topScorerRepository.saveAll(rows);
    }

    private static String fit(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max);
    }
}
