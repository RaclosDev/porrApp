package com.porra.mundial.service;

import com.porra.mundial.model.Team;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 🛡️ Servicio de Equipos
 * Gestiona a las 48 selecciones del Mundial.
 */
@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;

    // "Dame a todos los equipos ordenados"
    public List<Team> getAllTeams() {
        return teamRepository.findAllByOrderByGroupNameAscNameAsc();
    }

    // "Agrupa a los equipos por letra de grupo" (Devuelve algo así como A -> [España, Francia...])
    public Map<String, List<Team>> getTeamsByGroup() {
        return getAllTeams().stream()
                .collect(Collectors.groupingBy(
                        Team::getGroupName,
                        TreeMap::new,
                        Collectors.toList()
                ));
    }

    public Optional<Team> findByName(String name) {
        return teamRepository.findByName(name);
    }

    public Optional<Team> findByExternalId(String externalId) {
        return teamRepository.findByExternalId(externalId);
    }

    public Team save(Team team) {
        return teamRepository.save(team);
    }

    /**
     * 🎲 Traductor de Cuotas de Apuestas.
     * Este método sustituye a tu antiguo archivo `data.js`.
     * Convierte los datos de Java al mismo formato JSON que antes leías de ese archivo
     * para no romper el frontend.
     */
    public Map<String, List<Map<String, Object>>> getGroupOdds() {
        Map<String, List<Map<String, Object>>> result = new TreeMap<>();
        Map<String, List<Team>> groups = getTeamsByGroup();

        groups.forEach((groupName, teams) -> {
            List<Map<String, Object>> teamList = teams.stream().map(t -> {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("name", t.getName());
                entry.put("win", t.getWinOdds());
                entry.put("qualify", t.getQualifyOdds());
                entry.put("outright", t.getOutrightOdds());
                return entry;
            }).collect(Collectors.toList());
            result.put(groupName, teamList);
        });

        return result;
    }
}
