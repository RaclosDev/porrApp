package app.porrapp.repository;

import app.porrapp.model.CompetitionTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Equipos que juegan cada competición y, en los torneos con grupos, en cuál. Los liga la importación de su
 * catálogo y de sus partidos; a los de una competición propia, quien los da de alta.
 */
@Repository
public interface CompetitionTeamRepository extends JpaRepository<CompetitionTeam, Long> {

    /** Equipos sorteados en los grupos de un torneo, con el equipo ya cargado, por grupo y nombre. */
    @Query("""
            select ct from CompetitionTeam ct join fetch ct.team t
            where ct.competition.id = :competitionId and ct.groupName is not null
            order by ct.groupName, t.name
            """)
    List<CompetitionTeam> findGroupTeams(Long competitionId);

    /** Grupo de cada equipo sorteado en una competición (id del equipo → grupo). */
    default Map<Long, String> groupByTeamId(Long competitionId) {
        return findGroupTeams(competitionId).stream()
                .collect(Collectors.toMap(drawn -> drawn.getTeam().getId(), CompetitionTeam::getGroupName));
    }

    /** Si el torneo ya tiene su sorteo: algún equipo con grupo. */
    boolean existsByCompetitionIdAndGroupNameIsNotNull(Long competitionId);

    Optional<CompetitionTeam> findByCompetitionIdAndTeamId(Long competitionId, Long teamId);

    @Query("select ct.team.id from CompetitionTeam ct where ct.competition.id = :competitionId")
    List<Long> findTeamIdsByCompetitionId(Long competitionId);

    /** Liga un equipo a una competición en la que juega, si aún no lo estaba. */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO competition_teams (competition_id, team_id) VALUES (:competitionId, :teamId) "
            + "ON CONFLICT (competition_id, team_id) DO NOTHING", nativeQuery = true)
    void link(Long competitionId, Long teamId);
}
