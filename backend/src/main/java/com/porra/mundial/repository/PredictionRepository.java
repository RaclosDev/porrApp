package com.porra.mundial.repository;

import com.porra.mundial.model.Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PredictionRepository extends JpaRepository<Prediction, Long> {

    List<Prediction> findByEditionLeagueId(Long groupId);

    List<Prediction> findByUserIdAndEditionLeagueId(Long userId, Long groupId);

    @Query("SELECT p FROM Prediction p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.edition e LEFT JOIN FETCH e.league l WHERE l.id = :groupId OR (:groupId = 1 AND (p.edition IS NULL OR l.id IS NULL))")
    List<Prediction> findByEditionLeagueIdWithUserAndEdition(@Param("groupId") Long groupId);

    @Query("SELECT p FROM Prediction p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.edition e LEFT JOIN FETCH e.league WHERE p.user.googleEmail = :email")
    List<Prediction> findByUserGoogleEmailWithUserAndEdition(@Param("email") String email);

    @Query("SELECT p FROM Prediction p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.edition")
    List<Prediction> findAllWithUserAndEdition();

    Optional<Prediction> findByUserGoogleEmailAndEditionLeagueId(String email, Long groupId);

    /**
     * Marca como pendientes de recalcular las puntuaciones guardadas de las porras de una competición.
     *
     * @return número de porras invalidadas
     */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE Prediction p SET p.scoreCalculatedAt = NULL WHERE p.scoreCalculatedAt IS NOT NULL"
            + " AND p.edition.id IN (SELECT e.id FROM Edition e WHERE e.competition.id = :competitionId)")
    int clearCalculatedScoresByCompetitionId(@Param("competitionId") Long competitionId);

    /**
     * Marca como pendientes de recalcular las puntuaciones guardadas de las porras de una edición.
     *
     * @return número de porras invalidadas
     */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE Prediction p SET p.scoreCalculatedAt = NULL WHERE p.scoreCalculatedAt IS NOT NULL"
            + " AND p.edition.id = :editionId")
    int clearCalculatedScoresByEditionId(@Param("editionId") Long editionId);
}
