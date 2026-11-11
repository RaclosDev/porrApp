package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerRound;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScoreTrackerRoundRepository extends JpaRepository<ScoreTrackerRound, Long> {

    List<ScoreTrackerRound> findByLeagueIdOrderByIdAsc(Long leagueId);

    List<ScoreTrackerRound> findBySessionIdOrderByIdAsc(Long sessionId);

    List<ScoreTrackerRound> findByLeagueIdIn(Collection<Long> leagueIds);

    long countByLeagueId(Long leagueId);

    Optional<ScoreTrackerRound> findByLeagueIdAndClientRequestId(Long leagueId, UUID clientRequestId);
}
