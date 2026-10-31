package com.porra.mundial.repository;

import com.porra.mundial.model.Match;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Pageable;
import com.porra.mundial.model.MatchStatusNormalized;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    // Missing teams remain visible; only two explicit placeholders hide a match.
    String RADAR_MATCHES = """
            SELECT m FROM Match m LEFT JOIN FETCH m.homeTeam h LEFT JOIN FETCH m.awayTeam a
            LEFT JOIN FETCH m.competition LEFT JOIN FETCH m.winnerTeam
            WHERE (:competitionId IS NULL OR m.competition.id = :competitionId)
              AND (h IS NULL OR a IS NULL OR NOT (
                (LOWER(h.name) IN ('por definir', 'tbd') OR LOWER(COALESCE(h.nameEn, '')) = 'tbd')
                AND (LOWER(a.name) IN ('por definir', 'tbd') OR LOWER(COALESCE(a.nameEn, '')) = 'tbd')))
            """;

    @Query(RADAR_MATCHES + """
              AND (m.finished = FALSE OR m.finished IS NULL)
              AND (m.status IS NULL OR m.status IN :statuses)
              AND m.matchDate > :past AND m.matchDate < :soon
            ORDER BY m.matchDate DESC
            """)
    List<Match> findRadarLive(@Param("competitionId") Long competitionId,
                             @Param("past") LocalDateTime past, @Param("soon") LocalDateTime soon,
                             @Param("statuses") Collection<MatchStatusNormalized> statuses);

    @Query(RADAR_MATCHES + " AND m.finished = TRUE ORDER BY m.matchDate DESC")
    List<Match> findRadarLast(@Param("competitionId") Long competitionId, Pageable pageable);

    @Query(RADAR_MATCHES + """
              AND m.finished = FALSE AND (m.status IS NULL OR m.status = :scheduled)
              AND m.matchDate > :now
            ORDER BY m.matchDate ASC
            """)
    List<Match> findRadarNext(@Param("competitionId") Long competitionId, @Param("now") LocalDateTime now,
                             @Param("scheduled") MatchStatusNormalized scheduled, Pageable pageable);

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
    /** Filas de V34 que aún apuntan a los equipos provisionales de V33.1. */
    @Query("""
            SELECT m FROM Match m JOIN FETCH m.competition c
            JOIN FETCH m.homeTeam h JOIN FETCH m.awayTeam a LEFT JOIN FETCH m.winnerTeam
            WHERE c.externalId = 'esp.1' AND m.id > :afterId AND m.externalId IS NOT NULL
              AND (h.name LIKE 'Equipo LaLiga %' OR a.name LIKE 'Equipo LaLiga %')
            ORDER BY m.id
            """)
    List<Match> findLegacyPlaceholderFixtures(@Param("afterId") long afterId, Pageable pageable);
}
