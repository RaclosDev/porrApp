package com.porra.mundial.controller;

import com.porra.mundial.service.TeamService;
import com.porra.mundial.dto.TeamOddsDTO;
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
     *  GET /api/teams/odds
     * Este endpoint sustituye al antiguo archivo hardcodeado `data.js`.
     * Devuelve las probabilidades de cada equipo organizadas por Grupos (A, B, C...) para armar
     * la pantalla interactiva de hacer la porra en el Frontend.
     * 
     * @return Mapa agrupado donde la clave es el Grupo ("A", "B") y el valor son los Equipos.
     */
    @GetMapping("/odds")
    public Map<String, List<TeamOddsDTO>> getGroupOdds() {
        return teamService.getGroupOdds();
    }
}
