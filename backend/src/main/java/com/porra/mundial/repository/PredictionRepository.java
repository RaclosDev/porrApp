package com.porra.mundial.repository;

import com.porra.mundial.model.Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface PredictionRepository extends JpaRepository<Prediction, Long> {

    List<Prediction> findByEditionLeagueId(Long groupId);

    boolean existsByEditionLeagueId(Long groupId);

    /** Borra en una sentencia las predicciones de un usuario en una liga (sus partidos caen en cascada). */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM Prediction p WHERE p.user.id = :userId"
            + " AND p.edition.id IN (SELECT e.id FROM Edition e WHERE e.league.id = :leagueId)")
    int deleteByUserIdAndLeagueId(@Param("userId") Long userId, @Param("leagueId") Long leagueId);

    /** Borra en una sentencia todas las predicciones de una liga. */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM Prediction p WHERE p.edition.id IN (SELECT e.id FROM Edition e WHERE e.league.id = :leagueId)")
    int deleteByLeagueId(@Param("leagueId") Long leagueId);

    List<Prediction> findByUserIdAndEditionLeagueId(Long userId, Long groupId);

    List<Prediction> findByUserId(Long userId);

    /** Olvida quién marcó el pago para poder borrar la cuenta de ese administrador. */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE Prediction p SET p.paymentMarkedBy = NULL WHERE p.paymentMarkedBy.id = :userId")
    int clearPaymentMarkedBy(@Param("userId") Long userId);

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
            + " AND (p.edition.id IN (SELECT e.id FROM Edition e WHERE e.competition.id = :competitionId)"
            + " OR p.edition.id IN (SELECT c.id.editionId FROM EditionCompetition c"
            + " WHERE c.id.competitionId = :competitionId))")
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

    /**
     * Guarda la puntuación calculada de una porra tocando solo las columnas de puntos, para que
     * leer la clasificación nunca pise una predicción guardada a la vez.
     * <p>
     * Va en su propia transacción: la clasificación se pide también desde transacciones de solo lectura
     * («Mis ligas»), donde el UPDATE fallaría y dejaría abortada la transacción de quien llama. No la llames
     * con la fila bloqueada en la transacción actual: esperaría a sí misma.
     */
    @Modifying
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query("UPDATE Prediction p SET p.totalPoints = :total, p.r1Points = :r1, p.r32Points = :r32,"
            + " p.r16Points = :r16, p.qfPoints = :qf, p.sfPoints = :sf, p.finalsPoints = :finals,"
            + " p.scorerPoints = :scorer, p.matchPoints = :matchPoints, p.scoreCalculatedAt = :calculatedAt"
            + " WHERE p.id = :id")
    int saveCalculatedScore(@Param("id") Long id, @Param("total") Integer total, @Param("r1") Integer r1,
                            @Param("r32") Integer r32, @Param("r16") Integer r16, @Param("qf") Integer qf,
                            @Param("sf") Integer sf, @Param("finals") Integer finals,
                            @Param("scorer") Integer scorer, @Param("matchPoints") Integer matchPoints,
                            @Param("calculatedAt") java.time.Instant calculatedAt);

    /** Guarda si la porra ya está eliminada en una liga superviviente, junto a sus puntos. */
    @Modifying
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query("UPDATE Prediction p SET p.survivorEliminated = :eliminated WHERE p.id = :id")
    int saveSurvivorEliminated(@Param("id") Long id, @Param("eliminated") boolean eliminated);
}
