package app.porrapp.repository;

import app.porrapp.model.TopScorer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TopScorerRepository extends JpaRepository<TopScorer, Long> {

    List<TopScorer> findByCompetitionIdOrderByPositionAsc(Long competitionId);

    /** Borrado directo: tiene que ejecutarse antes de insertar la lista nueva, que reutiliza los puestos. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM TopScorer t WHERE t.competitionId = :competitionId")
    void deleteByCompetitionId(@Param("competitionId") Long competitionId);
}
