package app.porrapp.repository;

import app.porrapp.model.Competition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface CompetitionRepository extends JpaRepository<Competition, Long> {
    boolean existsByIdAndOwnerLeagueIsNotNull(Long id);

    /**
     * Competiciones cuyos partidos no salen en los listados públicos: las privadas de una liga y las
     * antiguas sin proveedor de datos ni liga dueña (nadie las sincroniza, así que sus partidos se
     * quedan para siempre sin resultado ni estado final).
     */
    @Query("SELECT c.id FROM Competition c WHERE c.ownerLeague IS NOT NULL OR c.externalId IS NULL OR c.externalId = ''")
    List<Long> findHiddenCompetitionIds();
    Optional<Competition> findByName(String name);

    Optional<Competition> findByExternalId(String externalId);

    List<Competition> findByExternalIdIn(java.util.Collection<String> externalIds);

    /**
     * @param externalId Código slug de la competición en ESPN.
     * @return El id de la competición asociada, sin cargar la entidad.
     */
    @Query("SELECT c.id FROM Competition c WHERE c.externalId = :externalId")
    Optional<Long> findIdByExternalId(@Param("externalId") String externalId);

    /** Competiciones enlazadas a una edición que junta varias. */
    @Query("SELECT c FROM Competition c WHERE c.id IN "
            + "(SELECT ec.id.competitionId FROM EditionCompetition ec WHERE ec.id.editionId = :editionId)")
    List<Competition> findByEditionId(@Param("editionId") Long editionId);
}
