package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerPlayer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScoreTrackerPlayerRepository extends JpaRepository<ScoreTrackerPlayer, Long> {

    List<ScoreTrackerPlayer> findByTrackerIdOrderByPositionAsc(Long trackerId);

    List<ScoreTrackerPlayer> findByTrackerIdIn(Collection<Long> trackerIds);

    long countByTrackerId(Long trackerId);

    Optional<ScoreTrackerPlayer> findByTrackerIdAndUserId(Long trackerId, Long userId);
}
