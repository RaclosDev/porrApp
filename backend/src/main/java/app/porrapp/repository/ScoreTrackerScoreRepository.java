package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ScoreTrackerScoreRepository
        extends JpaRepository<ScoreTrackerScore, ScoreTrackerScore.Key> {

    List<ScoreTrackerScore> findByRoundIdIn(Collection<Long> roundIds);

    List<ScoreTrackerScore> findByPlayerIdIn(Collection<Long> playerIds);
}
