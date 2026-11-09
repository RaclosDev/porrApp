package app.porrapp.repository;

import app.porrapp.model.Edition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface EditionRepository extends JpaRepository<Edition, Long> {
    
    @Query("SELECT e FROM Edition e LEFT JOIN FETCH e.league LEFT JOIN FETCH e.competition WHERE e.league.id = :leagueId AND e.status = :status")
    Optional<Edition> findByLeagueIdAndStatus(@Param("leagueId") Long leagueId, @Param("status") String status);
    
    List<Edition> findByLeagueId(Long leagueId);

    @Query("SELECT e FROM Edition e LEFT JOIN FETCH e.league LEFT JOIN FETCH e.competition WHERE e.competition.id = :competitionId AND e.status = :status")
    List<Edition> findByCompetitionIdAndStatus(@Param("competitionId") Long competitionId, @Param("status") String status);
    
    /**
     * Devuelve los IDs de las competiciones canónicas (con external_id) que tienen
     * al menos una edición activa. Se usa para rellenar calendarios sin cargar
     * relaciones LAZY fuera de transacción.
     */
    @Query("SELECT DISTINCT e.competition.id FROM Edition e WHERE e.status = 'ACTIVE' AND e.competition.externalId IS NOT NULL AND e.competition.externalId <> ''")
    List<Long> findActiveCanonicalCompetitionIds();

    /**
     * Competiciones oficiales de las que toma partidos alguna liga activa: la principal de cada edición y,
     * en las ligas que juntan varias, también las demás. Son las únicas que merece la pena sincronizar a
     * menudo; el resto las pone al día la barrida diaria.
     */
    @Query("SELECT c.id FROM Competition c WHERE c.externalId IS NOT NULL AND c.externalId <> '' AND ("
            + "c.id IN (SELECT e.competition.id FROM Edition e WHERE e.status = 'ACTIVE')"
            + " OR c.id IN (SELECT ec.id.competitionId FROM EditionCompetition ec, Edition e2"
            + " WHERE e2.id = ec.id.editionId AND e2.status = 'ACTIVE'))")
    List<Long> findCompetitionIdsInUse();

    /** Ligas que toman partidos de alguna de esas competiciones, sea la principal o una de las añadidas. */
    @Query("SELECT DISTINCT e.league.id FROM Edition e WHERE e.competition.id IN :competitionIds"
            + " OR e.id IN (SELECT ec.id.editionId FROM EditionCompetition ec"
            + " WHERE ec.id.competitionId IN :competitionIds)")
    List<Long> findLeagueIdsUsingCompetitions(
            @org.springframework.data.repository.query.Param("competitionIds") java.util.Collection<Long> competitionIds);

    @Query("SELECT e FROM Edition e LEFT JOIN FETCH e.league LEFT JOIN FETCH e.competition WHERE e.league.id IN :leagueIds AND e.status = :status")
    List<Edition> findByLeagueIdInAndStatus(@Param("leagueIds") List<Long> leagueIds, @Param("status") String status);

    /** Ligas de tenis activas que siguen varios torneos, con su liga y su competición principal. */
    @Query("SELECT e FROM Edition e JOIN FETCH e.league JOIN FETCH e.competition WHERE e.status = 'ACTIVE' AND e.tennisScope IS NOT NULL")
    List<Edition> findActiveWithTennisScope();

    /** Ediciones activas de un formato, con su liga y su competición. */
    @Query("SELECT e FROM Edition e JOIN FETCH e.league JOIN FETCH e.competition WHERE e.status = 'ACTIVE' AND e.poolFormat = :format")
    List<Edition> findActiveByPoolFormat(@Param("format") app.porrapp.model.PoolFormat format);
}
