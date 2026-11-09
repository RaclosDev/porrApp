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
    
    /**
     * Equipo del catálogo con ese nombre. El nombre no identifica a un equipo (dos clubes pueden llamarse
     * igual): solo sirve para el comodín y para los equipos sembrados que aún no tienen id externo.
     */
    @Query("SELECT t FROM Team t WHERE t.name = :name AND t.competition IS NULL ORDER BY t.id")
    List<Team> findAllCatalogByName(@Param("name") String name);

    default Optional<Team> findCatalogByName(String name) {
        return findAllCatalogByName(name).stream().findFirst();
    }

    List<Team> findByCompetitionIdOrderByNameAsc(Long competitionId);

    boolean existsByCompetitionIdAndNameIgnoreCase(Long competitionId, String name);
    
    /** Equipo con ese id externo, único entre deportes y proveedores (lleva el prefijo de su deporte). */
    Optional<Team> findByExternalId(String externalId);

}
