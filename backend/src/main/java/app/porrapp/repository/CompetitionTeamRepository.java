package app.porrapp.repository;

import app.porrapp.model.CompetitionTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

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

    boolean existsByCompetitionId(Long competitionId);
}
