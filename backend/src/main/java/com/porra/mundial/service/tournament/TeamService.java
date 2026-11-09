package com.porra.mundial.service.tournament;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.TournamentFormat;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.dto.TeamOddsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;

    /** Equipos sembrados en cada grupo ("A" → equipos); el resto de equipos no tiene grupo. */
    private Map<String, List<Team>> seededGroups() {
        return teamRepository.findByCompetitionIsNullOrderByGroupNameAscNameAsc().stream()
                .filter(Team::isWorldCupGroupTeam)
                .collect(Collectors.groupingBy(
                        t -> t.getGroupName().toUpperCase().trim(),
                        TreeMap::new,
                        Collectors.toList()
                ));
    }

    /**
     * Busca un equipo por su nombre exacto en castellano (Ej. "Inglaterra").
     */
    public Optional<Team> findByName(String name) {
        return teamRepository.findByName(name);
    }

    /**
     * Busca un equipo por su identificador externo en ESPN.
     */
    public Optional<Team> findByExternalId(String externalId) {
        return teamRepository.findByExternalId(externalId);
    }

    /**
     * Guarda o actualiza un equipo en la base de datos.
     */
    @org.springframework.cache.annotation.CacheEvict(value = "groupOdds", allEntries = true)
    @Transactional
    public Team save(Team team) {
        return teamRepository.save(team);
    }

    /**
     * Probabilidades de cada grupo de un torneo, para ordenar su cuadro antes de empezar. Solo las tiene un
     * torneo con los grupos ya sorteados; el resto no ofrece ninguna.
     */
    @org.springframework.cache.annotation.Cacheable(value = "groupOdds", key = "#tournament.id")
    public Map<String, List<TeamOddsDTO>> getGroupOdds(Competition tournament) {
        Map<String, List<TeamOddsDTO>> result = new TreeMap<>();
        if (!TournamentFormat.of(tournament).seededGroups()) return result;
        seededGroups().forEach((groupName, teams) -> {
            List<TeamOddsDTO> teamList = teams.stream()
                    .map(t -> new TeamOddsDTO(t.getName(), t.getWinOdds(), t.getQualifyOdds(), t.getOutrightOdds()))
                    .collect(Collectors.toList());
            result.put(groupName, teamList);
        });
        return result;
    }
}
