package com.porra.mundial.repository;

import com.porra.mundial.model.Edition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

/**
 * Repositorio JPA para las Ediciones de Grupos.
 */
@Repository
public interface EditionRepository extends JpaRepository<Edition, Long> {
    
    /**
     * Busca una edición específica de un grupo por su estado (ej. ACTIVE).
     */
    @Query("SELECT e FROM Edition e LEFT JOIN FETCH e.league LEFT JOIN FETCH e.competition WHERE e.league.id = :leagueId AND e.status = :status")
    Optional<Edition> findByLeagueIdAndStatus(@Param("leagueId") Long leagueId, @Param("status") String status);
    
    /**
     * Devuelve el historial completo de ediciones que ha jugado un grupo a lo largo del tiempo.
     */
    List<Edition> findByLeagueId(Long leagueId);
    
    /**
     * Devuelve los IDs de las competiciones canónicas (con external_id) que tienen
     * al menos una edición activa. Se usa para rellenar calendarios sin cargar
     * relaciones LAZY fuera de transacción.
     */
    @Query("SELECT DISTINCT e.competition.id FROM Edition e WHERE e.status = 'ACTIVE' AND e.competition.externalId IS NOT NULL AND e.competition.externalId <> ''")
    List<Long> findActiveCanonicalCompetitionIds();

    /**
     * Devuelve las ediciones activas para un conjunto de grupos (usado en vistas combinadas).
     */
    @Query("SELECT e FROM Edition e LEFT JOIN FETCH e.league LEFT JOIN FETCH e.competition WHERE e.league.id IN :leagueIds AND e.status = :status")
    List<Edition> findByLeagueIdInAndStatus(@Param("leagueIds") List<Long> leagueIds, @Param("status") String status);
}
