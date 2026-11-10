package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerRoundChange;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScoreTrackerRoundChangeRepository extends JpaRepository<ScoreTrackerRoundChange, Long> {
    List<ScoreTrackerRoundChange> findByLeagueIdAndRoundIdOrderByIdAsc(Long leagueId, Long roundId);
}
