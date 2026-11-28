package app.porrapp.service.admin;

import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.LeaguePlan;
import app.porrapp.repository.LeagueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Plan de cada liga: lo asigna a mano la administración mientras no haya pagos en la app. */
@Service
@RequiredArgsConstructor
public class AdminLeaguePlanService {

    private final LeagueRepository leagues;

    @Transactional
    public void set(Long leagueId, LeaguePlan plan, boolean pokerMusic) {
        League league = leagues.findById(leagueId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        league.setPlan(plan);
        league.setPokerMusic(pokerMusic);
    }
}
