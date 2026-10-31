package com.porra.mundial.repository;

import com.porra.mundial.model.MatchPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

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

    Optional<MatchPrediction> findByPredictionIdAndMatchId(Long predictionId, Long matchId);

    List<MatchPrediction> findByPredictionEditionLeagueId(Long leagueId);

    List<MatchPrediction> findByMatchId(Long matchId);

    boolean existsByMatchIdAndPointsAwardedIsNull(Long matchId);

}
