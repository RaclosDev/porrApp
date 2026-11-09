package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerRound;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ScoreTrackerRoundRepository extends JpaRepository<ScoreTrackerRound, Long> {

    List<ScoreTrackerRound> findByTrackerIdOrderByIdAsc(Long trackerId);

    List<ScoreTrackerRound> findByTrackerIdIn(Collection<Long> trackerIds);

    long countByTrackerId(Long trackerId);
}
