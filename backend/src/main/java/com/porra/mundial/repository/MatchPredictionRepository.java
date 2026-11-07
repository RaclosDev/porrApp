package com.porra.mundial.repository;

import com.porra.mundial.model.MatchPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/**
 * Repositorio Spring Data JPA para pronósticos de partidos directos (MatchPrediction).
 */
@Repository
public interface MatchPredictionRepository extends JpaRepository<MatchPrediction, Long> {

    List<MatchPrediction> findByPredictionId(Long predictionId);

    List<MatchPrediction> findByPredictionIdAndMatchIdIn(Long predictionId, Collection<Long> matchIds);

    /** Los pronósticos por partido de varias porras en una sola consulta, con el partido y sus equipos. */
    @Query("SELECT mp FROM MatchPrediction mp JOIN FETCH mp.match m"
            + " LEFT JOIN FETCH m.homeTeam LEFT JOIN FETCH m.awayTeam"
            + " WHERE mp.prediction.id IN :predictionIds")
    List<MatchPrediction> findWithMatchByPredictionIdIn(@Param("predictionIds") Collection<Long> predictionIds);

    /** Los pronósticos por partido de una edición en una sola consulta, con el partido y sus equipos. */
    @Query("SELECT mp FROM MatchPrediction mp JOIN FETCH mp.match m"
            + " LEFT JOIN FETCH m.homeTeam LEFT JOIN FETCH m.awayTeam"
            + " WHERE mp.prediction.edition.id = :editionId")
    List<MatchPrediction> findWithMatchByEditionId(@Param("editionId") Long editionId);

    /** Los pronósticos de una edición para unos partidos, con su partido y su autor. */
    @Query("SELECT mp FROM MatchPrediction mp JOIN FETCH mp.match m JOIN FETCH mp.prediction p"
            + " JOIN FETCH p.user WHERE p.edition.id = :editionId AND m.id IN :matchIds")
    List<MatchPrediction> findWithUserByEditionIdAndMatchIds(@Param("editionId") Long editionId,
                                                             @Param("matchIds") Collection<Long> matchIds);


    List<MatchPrediction> findByPredictionEditionLeagueId(Long leagueId);

    /** Los pronósticos por partido de todas las porras de una edición, con su partido. */
    @Query("SELECT mp FROM MatchPrediction mp JOIN FETCH mp.match WHERE mp.prediction.edition.id = :editionId")
    List<MatchPrediction> findWithMatchByPredictionEditionId(@Param("editionId") Long editionId);

    /** Los pronósticos por partido de una edición con su partido y su usuario (fuera de transacción). */
    @Query("SELECT mp FROM MatchPrediction mp JOIN FETCH mp.prediction p JOIN FETCH p.user"
            + " JOIN FETCH mp.match WHERE p.edition.id = :editionId")
    List<MatchPrediction> findWithMatchAndUserByEditionId(@Param("editionId") Long editionId);

    @Query("SELECT mp FROM MatchPrediction mp JOIN FETCH mp.prediction p LEFT JOIN FETCH p.user"
            + " JOIN FETCH mp.match m LEFT JOIN FETCH m.homeTeam LEFT JOIN FETCH m.awayTeam"
            + " WHERE mp.match.id = :matchId AND p.edition.league.id = :leagueId")
    List<MatchPrediction> findFriendsByMatchAndLeague(@Param("matchId") Long matchId,
                                                   @Param("leagueId") Long leagueId);

    List<MatchPrediction> findByMatchId(Long matchId);

    long countByMatchId(Long matchId);

    boolean existsByMatchIdAndPointsAwardedIsNull(Long matchId);

    /** Pares (usuario, partido) que ya tienen predicción en una edición, entre los partidos indicados. */
    @Query("SELECT mp.prediction.user.id, mp.match.id FROM MatchPrediction mp"
            + " WHERE mp.prediction.edition.id = :editionId AND mp.match.id IN :matchIds")
    List<Object[]> findPredictedUserMatchPairs(@Param("editionId") Long editionId,
                                               @Param("matchIds") Collection<Long> matchIds);

    /** Número de predicciones de cada partido en una edición: (id del partido, cuántas). */
    @Query("SELECT mp.match.id, COUNT(mp) FROM MatchPrediction mp WHERE mp.prediction.edition.id = :editionId"
            + " GROUP BY mp.match.id")
    List<Object[]> countByMatchForEdition(@Param("editionId") Long editionId);

    /** Borra las predicciones de una edición sobre los partidos indicados. */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @Query("DELETE FROM MatchPrediction mp WHERE mp.match.id IN :matchIds"
            + " AND mp.prediction.id IN (SELECT p.id FROM Prediction p WHERE p.edition.id = :editionId)")
    int deleteByEditionIdAndMatchIdIn(@Param("editionId") Long editionId,
                                      @Param("matchIds") Collection<Long> matchIds);
}
