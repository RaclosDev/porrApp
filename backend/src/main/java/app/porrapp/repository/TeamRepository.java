package app.porrapp.repository;

import app.porrapp.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    
    @Query("SELECT t FROM Team t WHERE t.name = :name AND t.competition IS NULL")
    Optional<Team> findByName(@Param("name") String name);

    List<Team> findByCompetitionIdOrderByNameAsc(Long competitionId);

    boolean existsByCompetitionIdAndNameIgnoreCase(Long competitionId, String name);
    
    Optional<Team> findByExternalId(String externalId);

}
