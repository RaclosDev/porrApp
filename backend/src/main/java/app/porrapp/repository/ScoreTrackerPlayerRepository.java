package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerPlayer;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScoreTrackerPlayerRepository extends JpaRepository<ScoreTrackerPlayer, Long> {

    List<ScoreTrackerPlayer> findByLeagueIdOrderByPositionAsc(Long leagueId);

    List<ScoreTrackerPlayer> findByLeagueIdIn(Collection<Long> leagueIds);

    long countByLeagueId(Long leagueId);

    Optional<ScoreTrackerPlayer> findByLeagueIdAndUserId(Long leagueId, Long userId);

    List<ScoreTrackerPlayer> findByUserIdOrderByLeagueIdAsc(Long userId);

    /** El jugador con su fila bloqueada: si dos personas lo reclaman a la vez, la segunda ve que ya es de la primera. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ScoreTrackerPlayer p WHERE p.id = :id")
    Optional<ScoreTrackerPlayer> findWithLockById(@Param("id") Long id);
}
