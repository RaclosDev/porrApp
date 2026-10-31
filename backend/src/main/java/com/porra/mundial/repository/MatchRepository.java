package com.porra.mundial.repository;

import com.porra.mundial.model.Match;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio de Partidos.
 */
@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    List<Match> findByFinishedTrueOrderByMatchDateDesc();
    
    List<Match> findByFinishedFalseOrderByMatchDateAsc();
    
    /** Con sus equipos en la misma consulta: la sincronización la llama una vez por evento. */
    @EntityGraph(attributePaths = {"homeTeam", "awayTeam"})
    Optional<Match> findByExternalId(String externalId);

    List<Match> findByCompetitionId(Long competitionId);

    List<Match> findByCompetitionIdOrderByMatchDateAsc(Long competitionId);

    long countByCompetitionId(Long competitionId);

    /**
     * Partidos de una competición que pueden ser de una jornada ({@code MatchRound.lookup}): por ronda o
     * grupo, por día o sin fecha. Con sus equipos, en una sola consulta.
     */
    @Query("""
            SELECT m FROM Match m LEFT JOIN FETCH m.homeTeam LEFT JOIN FETCH m.awayTeam
            WHERE m.competition.id = :competitionId
              AND (LOWER(m.round) IN :names OR LOWER(m.groupName) IN :names
                   OR (m.matchDate >= :dayStart AND m.matchDate < :dayEnd)
                   OR (:undated = TRUE AND m.matchDate IS NULL))
            ORDER BY m.matchDate ASC
            """)
    List<Match> findRoundCandidates(@Param("competitionId") Long competitionId,
                                    @Param("names") Collection<String> names,
                                    @Param("dayStart") LocalDateTime dayStart,
                                    @Param("dayEnd") LocalDateTime dayEnd,
                                    @Param("undated") boolean undated);
}
