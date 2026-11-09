package app.porrapp.repository;

import app.porrapp.model.Match;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Pageable;
import app.porrapp.model.MatchStatusNormalized;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    // Missing teams remain visible; only two explicit placeholders hide a match.
    String RADAR_MATCHES = """
            SELECT m FROM Match m LEFT JOIN FETCH m.homeTeam h LEFT JOIN FETCH m.awayTeam a
            LEFT JOIN FETCH m.competition rc LEFT JOIN FETCH m.winnerTeam
            WHERE (:competitionId IS NULL OR m.competition.id = :competitionId)
              AND (rc IS NULL OR rc.externalId IS NULL OR rc.externalId <> 'f1')
              AND (h IS NULL OR a IS NULL OR NOT (
                (LOWER(h.name) IN ('por definir', 'tbd') OR LOWER(COALESCE(h.nameEn, '')) = 'tbd')
                AND (LOWER(a.name) IN ('por definir', 'tbd') OR LOWER(COALESCE(a.nameEn, '')) = 'tbd')))
            """;

    /**
     * En juego o a punto de empezar. Aquí sí hacen falta los dos rivales reales: un evento sin
     * equipos (un cruce aún por definir) no se puede anunciar como partido en directo.
     */
    @Query(RADAR_MATCHES + """
              AND h IS NOT NULL AND a IS NOT NULL
              AND LOWER(h.name) NOT IN ('por definir', 'tbd') AND LOWER(COALESCE(h.nameEn, '')) <> 'tbd'
              AND LOWER(a.name) NOT IN ('por definir', 'tbd') AND LOWER(COALESCE(a.nameEn, '')) <> 'tbd'
              AND (m.finished = FALSE OR m.finished IS NULL)
              AND (m.status IS NULL OR m.status IN :statuses)
              AND m.matchDate > :past AND m.matchDate < :soon
            ORDER BY m.matchDate DESC
            """)
    List<Match> findRadarLive(@Param("competitionId") Long competitionId,
                             @Param("past") Instant past, @Param("soon") Instant soon,
                             @Param("statuses") Collection<MatchStatusNormalized> statuses);

    /** Partidos de una competición con una ronda numerada ("Jornada 12"). */
    List<Match> findByCompetitionIdAndRoundStartingWith(Long competitionId, String roundPrefix);

    @Query(RADAR_MATCHES + " AND m.finished = TRUE ORDER BY m.matchDate DESC")
    List<Match> findRadarLast(@Param("competitionId") Long competitionId, Pageable pageable);

    @Query(RADAR_MATCHES + """
              AND m.finished = FALSE AND (m.status IS NULL OR m.status = :scheduled)
              AND m.matchDate > :now
            ORDER BY m.matchDate ASC
            """)
    List<Match> findRadarNext(@Param("competitionId") Long competitionId, @Param("now") Instant now,
                             @Param("scheduled") MatchStatusNormalized scheduled, Pageable pageable);

    /** Con sus equipos en la misma consulta: la sincronización la llama una vez por evento. */
    @EntityGraph(attributePaths = {"homeTeam", "awayTeam"})
    Optional<Match> findByExternalId(String externalId);

    List<Match> findByCompetitionId(Long competitionId);

    List<Match> findByCompetitionIdOrderByMatchDateAsc(Long competitionId);

    long countByCompetitionId(Long competitionId);

    /** Si la competición guarda algún partido anterior a esa fecha. */
    boolean existsByCompetitionIdAndMatchDateBefore(Long competitionId, Instant date);

    /** Si la competición guarda algún partido posterior a esa fecha. */
    boolean existsByCompetitionIdAndMatchDateAfter(Long competitionId, Instant date);

    /** Partidos de la competición anteriores a esa fecha. */
    long countByCompetitionIdAndMatchDateBefore(Long competitionId, Instant date);

    /**
     * De los anteriores a esa fecha, los que aún pueden jugarse: ni terminados, ni cancelados, abandonados
     * o aplazados (un aplazado que sigue así cuando el proveedor ya ha cambiado de temporada no se va a jugar).
     */
    @Query("SELECT COUNT(m) FROM Match m WHERE m.competition.id = :competitionId AND m.matchDate < :date"
            + " AND (m.finished IS NULL OR m.finished = false) AND (m.status IS NULL OR m.status NOT IN ("
            + "app.porrapp.model.MatchStatusNormalized.CANCELLED, app.porrapp.model.MatchStatusNormalized.POSTPONED, "
            + "app.porrapp.model.MatchStatusNormalized.ABANDONED))")
    long countPendingBefore(@Param("competitionId") Long competitionId, @Param("date") Instant date);

    Optional<Match> findFirstByCompetitionIdAndMatchDateBeforeOrderByMatchDateAsc(Long competitionId, Instant date);

    Optional<Match> findFirstByCompetitionIdAndMatchDateBeforeOrderByMatchDateDesc(Long competitionId, Instant date);

    /** Ids de los partidos de la competición desde esa fecha. */
    @Query("SELECT m.id FROM Match m WHERE m.competition.id = :competitionId AND m.matchDate >= :date")
    List<Long> findIdsByCompetitionIdFrom(@Param("competitionId") Long competitionId, @Param("date") Instant date);

    /** Pasa esos partidos a otra fila de competición (la temporada nueva). */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Match m SET m.competition = :competition WHERE m.id IN :ids")
    int moveToCompetition(@Param("ids") java.util.Collection<Long> ids,
                          @Param("competition") app.porrapp.model.Competition competition);

    /**
     * Por competición: partidos, partidos sin terminar y partidos de fase de grupos. Sirve para saber al
     * crear una liga si la competición ya acabó y si tiene grupos que pronosticar.
     */
    @Query("SELECT m.competition.id, COUNT(m), SUM(CASE WHEN m.finished = true OR m.status = "
            + "app.porrapp.model.MatchStatusNormalized.CANCELLED THEN 0 ELSE 1 END), "
            + "SUM(CASE WHEN m.groupName IS NOT NULL AND m.groupName <> '' THEN 1 ELSE 0 END) "
            + "FROM Match m WHERE m.competition IS NOT NULL GROUP BY m.competition.id")
    List<Object[]> calendarStatsByCompetition();

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
                                    @Param("dayStart") Instant dayStart,
                                    @Param("dayEnd") Instant dayEnd,
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

    /** Partidos sin terminar de una competición que empiezan dentro del intervalo, con sus equipos. */
    @Query("SELECT m FROM Match m LEFT JOIN FETCH m.homeTeam LEFT JOIN FETCH m.awayTeam"
            + " WHERE m.competition.id = :competitionId AND m.matchDate > :from AND m.matchDate <= :to"
            + " AND (m.finished = FALSE OR m.finished IS NULL)")
    List<Match> findUnfinishedStartingBetween(@Param("competitionId") Long competitionId,
                                              @Param("from") Instant from, @Param("to") Instant to);

    /**
     * Partidos de la competición que aún cuentan: sin terminar, sin fecha o que empiezan desde {@code since}.
     * Si no queda ninguno, la competición ya se jugó entera.
     */
    @Query("SELECT COUNT(m) FROM Match m WHERE m.competition.id = :competitionId"
            + " AND (m.finished = FALSE OR m.finished IS NULL OR m.matchDate IS NULL OR m.matchDate >= :since)")
    long countOpenOrStartingSince(@Param("competitionId") Long competitionId, @Param("since") Instant since);

    /** Si alguna de esas competiciones tiene un partido por jugar: ni terminado ni cancelado. */
    @Query("SELECT CASE WHEN COUNT(m) > 0 THEN TRUE ELSE FALSE END FROM Match m"
            + " WHERE m.competition.id IN :competitionIds"
            + " AND (m.finished = FALSE OR m.finished IS NULL)"
            + " AND (m.status IS NULL OR m.status <> app.porrapp.model.MatchStatusNormalized.CANCELLED)")
    boolean existsOpenInCompetitions(@Param("competitionIds") Collection<Long> competitionIds);

    /** Competiciones con algún partido sin terminar cuyo inicio cae en el intervalo (partidos en juego). */
    @Query("SELECT DISTINCT m.competition.id FROM Match m WHERE (m.finished = FALSE OR m.finished IS NULL)"
            + " AND m.matchDate BETWEEN :from AND :to")
    List<Long> findCompetitionIdsWithOpenMatchesBetween(@Param("from") Instant from, @Param("to") Instant to);

    /** Inicio de la última pelea de cada velada (ronda) de la competición: {@code [ronda, fecha]}. */
    @Query("SELECT m.round, MAX(m.matchDate) FROM Match m WHERE m.competition.id = :competitionId"
            + " AND m.round IN :rounds GROUP BY m.round")
    List<Object[]> lastMatchDateByRound(@Param("competitionId") Long competitionId,
                                        @Param("rounds") Collection<String> rounds);
}
