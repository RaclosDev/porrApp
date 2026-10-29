package com.porra.mundial.repository;

import com.porra.mundial.model.MatchPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio Spring Data JPA para pronósticos de partidos directos (MatchPrediction).
 */
@Repository
public interface MatchPredictionRepository extends JpaRepository<MatchPrediction, Long> {

    List<MatchPrediction> findByPredictionId(Long predictionId);

    Optional<MatchPrediction> findByPredictionIdAndMatchId(Long predictionId, Long matchId);

    List<MatchPrediction> findByPredictionEditionLeagueId(Long leagueId);

    List<MatchPrediction> findByMatchId(Long matchId);

    boolean existsByMatchIdAndPointsAwardedIsNull(Long matchId);

    List<MatchPrediction> findByPredictionUserIdAndPredictionEditionLeagueId(Long userId, Long leagueId);
}
