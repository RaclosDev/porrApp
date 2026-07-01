package com.porra.mundial.controller;

import com.porra.mundial.model.Competition;
import com.porra.mundial.repository.CompetitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controlador REST que gestiona las Competiciones.
 * Las competiciones son las grandes ligas deportivas en las que se basa la aplicación, 
 * por ejemplo "World Cup" (Mundial) o "Euro Cup" (Eurocopa).
 * Sirve para la UI de creación de grupos donde el usuario escoge sobre qué competición apostar.
 */
@RestController
@RequestMapping("/api/competitions")
@RequiredArgsConstructor
public class CompetitionController {

    private final CompetitionRepository competitionRepository;

    /**
     * Recupera la lista de todas las competiciones disponibles en el sistema.
     * 
     * @return Lista JSON con objetos Competition (ID, Name).
     */
    @GetMapping
    public ResponseEntity<List<Competition>> getAllCompetitions() {
        return ResponseEntity.ok(competitionRepository.findAll());
    }
}
