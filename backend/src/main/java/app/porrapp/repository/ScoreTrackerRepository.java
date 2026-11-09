package app.porrapp.repository;

import app.porrapp.model.ScoreTracker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScoreTrackerRepository extends JpaRepository<ScoreTracker, Long> {

    Optional<ScoreTracker> findByJoinCode(String joinCode);

    List<ScoreTracker> findByIdInOrderByCreatedAtDesc(Collection<Long> ids);

    long countByOwnerUserId(Long ownerUserId);
}
