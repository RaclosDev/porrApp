package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerPlayer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScoreTrackerPlayerRepository extends JpaRepository<ScoreTrackerPlayer, Long> {

    List<ScoreTrackerPlayer> findByLeagueIdOrderByPositionAsc(Long leagueId);

    List<ScoreTrackerPlayer> findByLeagueIdIn(Collection<Long> leagueIds);

    long countByLeagueId(Long leagueId);

    Optional<ScoreTrackerPlayer> findByLeagueIdAndUserId(Long leagueId, Long userId);

    List<ScoreTrackerPlayer> findByUserIdOrderByLeagueIdAsc(Long userId);
}
