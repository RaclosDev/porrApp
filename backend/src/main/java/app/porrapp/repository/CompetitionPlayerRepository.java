package app.porrapp.repository;

import app.porrapp.model.CompetitionPlayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface CompetitionPlayerRepository extends JpaRepository<CompetitionPlayer, Long> {

    List<CompetitionPlayer> findByCompetitionId(Long competitionId);

    /** Cuándo se pidieron por última vez las plantillas de la competición; null si nunca han llegado. */
    @Query("SELECT MAX(p.fetchedAt) FROM CompetitionPlayer p WHERE p.competitionId = :competitionId")
    Instant lastFetchedAt(@Param("competitionId") Long competitionId);
}
