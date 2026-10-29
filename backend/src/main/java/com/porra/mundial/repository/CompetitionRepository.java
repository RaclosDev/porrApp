package com.porra.mundial.repository;

import com.porra.mundial.model.Competition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /**
     * @param externalId Código slug de la competición en ESPN (ej. "esp.1", "uefa.champions").
     * @return La competición asociada.
     */
    Optional<Competition> findByExternalId(String externalId);

    /**
     * @param externalId Código slug de la competición en ESPN.
     * @return El id de la competición asociada, sin cargar la entidad.
     */
    @Query("SELECT c.id FROM Competition c WHERE c.externalId = :externalId")
    Optional<Long> findIdByExternalId(@Param("externalId") String externalId);
}
