package app.porrapp.repository;

import app.porrapp.model.CompetitionTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Equipos que juegan cada competición y, en los torneos con grupos, en cuál. */
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

    boolean existsByCompetitionId(Long competitionId);
}
