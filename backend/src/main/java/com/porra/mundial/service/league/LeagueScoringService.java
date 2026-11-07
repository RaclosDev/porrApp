package com.porra.mundial.service.league;

import com.porra.mundial.service.prediction.MatchPredictionService;
import com.porra.mundial.service.prediction.ScoreInvalidationService;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.LeagueScoringDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.scoring.ScoringRuleSet;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


/**
 * Reglas de puntuación que el administrador de cada liga fija para su edición activa.
 * <p>
 * Cambiarlas vuelve a puntuar los partidos ya jugados de la edición e invalida las puntuaciones
 * guardadas de sus porras, de modo que la clasificación se recalcula con las reglas nuevas.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeagueScoringService {

    private final LeagueRepository leagueRepository;
    private final EditionRepository editionRepository;
    private final LeagueService leagueService;
    private final MatchPredictionService matchPredictionService;
    private final ScoreInvalidationService scoreInvalidationService;

    /**
     * Puntuación de la liga. La de una liga pública la ve cualquiera; la de una privada, solo para sus miembros.
     *
     * @throws BusinessException si la liga o su edición activa no existen o el usuario no puede verla
     */
    @Transactional(readOnly = true)
    public LeagueScoringDTO getScoring(Long leagueId, String email) {
        League league = findLeague(leagueId);
        leagueService.assertCanView(leagueId, email);
        Edition edition = activeEdition(leagueId);
        return LeagueScoringDTO.of(edition, canEdit(league, email));
    }

    /**
     * Cambia las reglas de la edición activa. Si cambian, vuelve a puntuar los partidos terminados
     * e invalida las puntuaciones guardadas para que la clasificación se recalcule.
     *
     * @throws BusinessException si no es el administrador o las reglas no son válidas
     */
    @Transactional
    public LeagueScoringDTO updateScoring(Long leagueId, ScoringRuleSet rules, String email) {
        League league = findLeague(leagueId);
        if (!isAdmin(league, email)) {
            throw BusinessException.forbidden("Solo el administrador de la liga puede cambiar la puntuación.");
        }
        if (rules == null) {
            throw BusinessException.badRequest("Faltan las reglas de puntuación.");
        }
        rules.validate();

        Edition edition = activeEdition(leagueId);
        String newRules = rules.toJson();
        if (!newRules.equals(ScoringRuleSet.forEdition(edition).toJson())) {
            edition.setScoringRulesJson(newRules);
            editionRepository.save(edition);
            int rescored = matchPredictionService.rescoreEdition(edition);
            int invalidated = scoreInvalidationService.invalidateEdition(edition.getId());
            log.info("Puntuación de la liga {} cambiada: {} pronósticos de partido repuntuados y {} porras por recalcular",
                    leagueId, rescored, invalidated);
        }
        return LeagueScoringDTO.of(edition, true);
    }

    private League findLeague(Long leagueId) {
        return leagueRepository.findById(leagueId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
    }

    private Edition activeEdition(Long leagueId) {
        return editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("La liga no tiene una edición activa"));
    }

    private static boolean canEdit(League league, String email) {
        return isAdmin(league, email);
    }

    private static boolean isAdmin(League league, String email) {
        String adminEmail = league.getAdminUser() != null ? league.getAdminUser().getGoogleEmail() : null;
        return email != null && adminEmail != null && adminEmail.equalsIgnoreCase(email);
    }
}
