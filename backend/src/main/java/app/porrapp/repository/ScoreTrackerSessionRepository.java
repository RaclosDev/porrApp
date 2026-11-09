package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ScoreTrackerSessionRepository extends JpaRepository<ScoreTrackerSession, Long> {

    List<ScoreTrackerSession> findByTrackerIdOrderByIdAsc(Long trackerId);

    Optional<ScoreTrackerSession> findFirstByTrackerIdOrderByIdDesc(Long trackerId);
}
