package com.porra.mundial.service.league;

import com.porra.mundial.model.League;
import com.porra.mundial.service.prediction.CustomCompetitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Crea una liga ya configurada: normas, cuota, puntuación y cierre de predicciones en la misma
 * transacción que la liga. Si algún ajuste no es válido no se crea nada, y cada ajuste pasa por
 * las mismas comprobaciones que cuando el administrador lo cambia después.
 */
@Service
@RequiredArgsConstructor
public class LeagueSetupService {

    private final LeagueService leagueService;
    private final LeagueScoringService leagueScoringService;
    private final CustomCompetitionService customCompetitionService;

    @Transactional
    public League create(NewLeague request, LeagueSetup setup) {
        // Repetir la creación (doble clic o reintento) devuelve la liga sin volver a configurarla.
        boolean repeated = request.creationKey() != null
                && leagueService.findCreatedWithKey(request.adminEmail(), request.creationKey()).isPresent();
        League league = leagueService.createLeague(request);
        if (repeated || setup == null || setup.isEmpty()) {
            return league;
        }

        Long id = league.getId();
        String email = request.adminEmail();
        if (setup.hasLeagueFields()) {
            league = leagueService.updateLeague(id, null, setup.rules(),
                    Boolean.TRUE.equals(setup.entryFee()) ? Boolean.TRUE : null, email);
        }
        if (setup.scoring() != null) {
            leagueScoringService.updateScoring(id, setup.scoring(), email);
        }
        if (setup.lockMode() != null) {
            customCompetitionService.setLockConfig(id, email, setup.lockMode(), setup.lockOffsetMinutes(),
                    setup.lockDate());
        }
        return league;
    }
}
