package com.porra.mundial.repository;

import com.porra.mundial.model.Competition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repositorio JPA para gestionar las Competiciones.
 */
@Repository
public interface CompetitionRepository extends JpaRepository<Competition, Long> {
    /**
     * @param name Nombre de la competición.
     * @return La competición que coincide exactamente con ese nombre.
     */
    Optional<Competition> findByName(String name);
}
