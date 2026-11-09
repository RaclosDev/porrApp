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
    /** Competición vigente con ese nombre; las temporadas archivadas lo comparten y no cuentan. */
    @Query("SELECT c FROM Competition c WHERE c.name = :name AND c.archivedAt IS NULL")
    Optional<Competition> findByName(@Param("name") String name);

    /**
     * Temporada vigente de una competición del proveedor. Las archivadas comparten id externo y solo se
     * llega a ellas por su id.
     */
    @Query("SELECT c FROM Competition c WHERE c.externalId = :externalId AND c.archivedAt IS NULL")
    Optional<Competition> findByExternalId(@Param("externalId") String externalId);

    /** Temporadas vigentes de esas competiciones del proveedor. */
    @Query("SELECT c FROM Competition c WHERE c.externalId IN :externalIds AND c.archivedAt IS NULL")
    List<Competition> findByExternalIdIn(@Param("externalIds") java.util.Collection<String> externalIds);

    /**
     * @param externalId Código slug de la competición en ESPN.
     * @return El id de su temporada vigente, sin cargar la entidad.
     */
    @Query("SELECT c.id FROM Competition c WHERE c.externalId = :externalId AND c.archivedAt IS NULL")
    Optional<Long> findIdByExternalId(@Param("externalId") String externalId);

    /** Competiciones enlazadas a una edición que junta varias. */
    @Query("SELECT c FROM Competition c WHERE c.id IN "
            + "(SELECT ec.id.competitionId FROM EditionCompetition ec WHERE ec.id.editionId = :editionId)")
    List<Competition> findByEditionId(@Param("editionId") Long editionId);
}
