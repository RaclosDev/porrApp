package com.porra.mundial.repository;

import com.porra.mundial.model.Edition;
import org.springframework.data.jpa.repository.JpaRepository;
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
    Optional<Edition> findByLeagueIdAndStatus(Long leagueId, String status);
    
    /**
     * Devuelve el historial completo de ediciones que ha jugado un grupo a lo largo del tiempo.
     */
    List<Edition> findByLeagueId(Long leagueId);
    
    /**
     * Devuelve las ediciones activas para un conjunto de grupos (usado en vistas combinadas).
     */
    List<Edition> findByLeagueIdInAndStatus(List<Long> leagueIds, String status);
}
