package com.porra.mundial.service.league;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.League;
import com.porra.mundial.repository.LeagueRepository;

/** Comprobación común de los cambios que solo puede hacer el administrador de una liga. */
final class LeagueAdmins {

    private LeagueAdmins() {
    }

    /** La liga, si existe y la administra {@code email}; si no, falla. */
    static League require(LeagueRepository leagues, Long leagueId, String email) {
        League league = leagues.findById(leagueId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (!league.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw BusinessException.forbidden("No tienes permiso para administrar esta liga.");
        }
        return league;
    }
}
