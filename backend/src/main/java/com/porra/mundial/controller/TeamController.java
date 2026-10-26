package com.porra.mundial.controller;

import com.porra.mundial.service.TeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * ️ Controlador de Equipos (Selecciones Nacionales).
 * La web llama aquí cuando necesita cargar las banderitas, nombres y cuotas de las selecciones.
 */
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    /**
     *  GET /api/teams
     * Devuelve la lista plana de todas las selecciones registradas en el sistema.
     * Sirve para rellenar los desplegables de búsqueda o configuración en React.
     * 
     * @return Lista de diccionarios con la ID, nombre, nombre en inglés y cuotas del equipo.
     */
    @GetMapping
    public List<Map<String, Object>> getAllTeams() {
        return teamService.getAllTeams().stream().map(t -> {
            Map<String, Object> dto = new java.util.LinkedHashMap<>();
            dto.put("id", t.getId());
            dto.put("name", t.getName());
            dto.put("nameEn", t.getNameEn());
            dto.put("logoUrl", t.getLogoUrl());
            dto.put("groupName", t.getGroupName());
            dto.put("winOdds", t.getWinOdds());
            dto.put("qualifyOdds", t.getQualifyOdds());
            dto.put("outrightOdds", t.getOutrightOdds());
            return dto;
        }).collect(java.util.stream.Collectors.toList());
    }

    /**
     *  GET /api/teams/odds
     * Este endpoint sustituye al antiguo archivo hardcodeado `data.js`.
     * Devuelve las cuotas de apuestas organizadas por Grupos (A, B, C...) para armar
     * la pantalla interactiva de hacer la porra en el Frontend.
     * 
     * @return Mapa agrupado donde la clave es el Grupo ("A", "B") y el valor son los Equipos.
     */
    @GetMapping("/odds")
    public Map<String, List<Map<String, Object>>> getGroupOdds() {
        return teamService.getGroupOdds();
    }
}
