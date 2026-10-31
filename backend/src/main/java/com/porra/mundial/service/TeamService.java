package com.porra.mundial.service;

import com.porra.mundial.model.Team;
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

    @org.springframework.cache.annotation.Cacheable("allTeams")
    public List<Team> getAllTeams() {
        return teamRepository.findAllByOrderByGroupNameAscNameAsc();
    }

    public Map<String, List<Team>> getTeamsByGroup() {
        return getAllTeams().stream()
                .filter(t -> t.getGroupName() != null && !"-".equals(t.getGroupName()) && !Team.PLACEHOLDER_NAME.equalsIgnoreCase(t.getName()))
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
    @org.springframework.cache.annotation.CacheEvict(value = {"allTeams", "groupOdds"}, allEntries = true)
    @Transactional
    public Team save(Team team) {
        return teamRepository.save(team);
    }

    /** Probabilidades por grupo con la forma que espera el frontend. */
    @org.springframework.cache.annotation.Cacheable("groupOdds")
    public Map<String, List<TeamOddsDTO>> getGroupOdds() {
        Map<String, List<TeamOddsDTO>> result = new TreeMap<>();
        Map<String, List<Team>> groups = getTeamsByGroup();

        groups.forEach((groupName, teams) -> {
            List<TeamOddsDTO> teamList = teams.stream()
                    .map(t -> new TeamOddsDTO(t.getName(), t.getWinOdds(), t.getQualifyOdds(), t.getOutrightOdds()))
                    .collect(Collectors.toList());
            result.put(groupName, teamList);
        });

        return result;
    }
}

