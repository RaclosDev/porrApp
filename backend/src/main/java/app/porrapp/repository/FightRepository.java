package app.porrapp.repository;

import app.porrapp.model.Fight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface FightRepository extends JpaRepository<Fight, Long> {

    List<Fight> findByEventExternalId(String eventExternalId);

    List<Fight> findByMatchIdIn(Collection<Long> matchIds);

    /** Peleas de los partidos de unas competiciones (las de la UFC). */
    @Query("select f from Fight f, Match m where m.id = f.matchId and m.competition.id in :competitionIds")
    List<Fight> findByCompetitionIdIn(@Param("competitionIds") Collection<Long> competitionIds);

    /**
     * Ligas de una sola velada: las que eligen sus peleas a mano y tienen alguna de esa velada. Las peleas
     * que se añadan después a la cartelera entran solas en ellas.
     */
    @Query("""
            select distinct c.id.editionId from EditionMatchChoice c, Fight f, Edition e
            where f.matchId = c.id.matchId and e.id = c.id.editionId and f.eventExternalId = :eventId
              and c.included = true and e.matchSelection = app.porrapp.model.MatchSelectionMode.CUSTOM
            """)
    List<Long> findEditionIdsFollowingEvent(@Param("eventId") String eventExternalId);

    /** Quién predijo una pelea y en qué liga: id de usuario, id de liga y nombre de liga. */
    @Query("""
            select p.user.id, l.id, l.name from MatchPrediction mp join mp.prediction p join p.edition e
            join e.league l where mp.match.id = :matchId
            """)
    List<Object[]> findPredictorsOfMatch(@Param("matchId") Long matchId);

    @Modifying(flushAutomatically = true)
    @Query("delete from MatchPrediction mp where mp.match.id = :matchId")
    int deletePredictionsOfMatch(@Param("matchId") Long matchId);

    /** Las esquinas se han cambiado: quien eligió al de la roja ahora lo tiene en la azul. */
    @Modifying(flushAutomatically = true)
    @Query("""
            update MatchPrediction mp set mp.predictionSign =
              case when mp.predictionSign = '1' then '2' when mp.predictionSign = '2' then '1'
                   else mp.predictionSign end
            where mp.match.id = :matchId
            """)
    int swapPredictedCorners(@Param("matchId") Long matchId);
}
