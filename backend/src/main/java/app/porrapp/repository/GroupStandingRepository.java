package app.porrapp.repository;

import app.porrapp.model.GroupStanding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

/** Clasificación de la fase de grupos de cada torneo. */
@Repository
public interface GroupStandingRepository extends JpaRepository<GroupStanding, Long> {

    /** Clasificación de un torneo, grupo a grupo y por posición dentro de cada uno. */
    List<GroupStanding> findByCompetitionIdOrderByGroupNameAscPositionAsc(Long competitionId);

    boolean existsByCompetitionId(Long competitionId);
}
