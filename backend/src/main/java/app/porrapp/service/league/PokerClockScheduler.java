package app.porrapp.service.league;

import app.porrapp.repository.PokerSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PokerClockScheduler {
    private final PokerSessionRepository sessions;
    private final PokerLeagueService poker;

    @Scheduled(fixedDelay = 5000)
    public void tick() {
        for (Long leagueId : sessions.findRunningLeagueIds()) {
            try {
                poker.advanceClock(leagueId);
            } catch (RuntimeException e) {
                log.warn("No se pudo actualizar el reloj de póker de la liga {}: {}", leagueId, e.getMessage());
            }
        }
    }
}
