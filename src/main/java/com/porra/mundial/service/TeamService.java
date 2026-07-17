package com.porra.mundial.service;

import com.porra.mundial.model.Team;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 🛡️ Servicio de Equipos (TeamService).
 * Gestiona a las selecciones del Torneo. Proporciona métodos para 
 * obtener sus datos básicos y las probabilidades calculadas (cuotas).
 */
@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;

    /**
     * "Dame a todos los equipos ordenados"
     * @return Lista completa de todos los equipos ordenados por grupo y luego alfabéticamente.
     */
    @org.springframework.cache.annotation.Cacheable("allTeams")
    public List<Team> getAllTeams() {
        return teamRepository.findAllByOrderByGroupNameAscNameAsc();
    }

    /**
     * "Agrupa a los equipos por letra de grupo" (Devuelve algo así como A -> [España, Francia...])
     * Útil para renderizar la pantalla inicial de predicción de Fase de Grupos.
     */
    public Map<String, List<Team>> getTeamsByGroup() {
        return getAllTeams().stream()
                .filter(t -> t.getGroupName() != null && !"-".equals(t.getGroupName()) && !"Por definir".equalsIgnoreCase(t.getName()))
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
    public Team save(Team team) {
        return teamRepository.save(team);
    }

    /**
     * 🎲 Traductor de Cuotas de Apuestas.
     * Este método sustituye a tu antiguo archivo estático `data.js`.
     * Convierte los datos almacenados en BD al mismo formato JSON que antes leías
     * por HTTP para que el frontend siga funcionando sin tener que reescribirlo.
     */
    @org.springframework.cache.annotation.Cacheable("groupOdds")
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
