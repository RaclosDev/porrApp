package com.porra.mundial.repository;

import com.porra.mundial.model.Competition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CompetitionRepository extends JpaRepository<Competition, Long> {
    Optional<Competition> findByName(String name);

    Optional<Competition> findByExternalId(String externalId);

    /**
     * @param externalId Código slug de la competición en ESPN.
     * @return El id de la competición asociada, sin cargar la entidad.
     */
    @Query("SELECT c.id FROM Competition c WHERE c.externalId = :externalId")
    Optional<Long> findIdByExternalId(@Param("externalId") String externalId);
}
