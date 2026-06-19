package com.porra.mundial.controller;

import com.porra.mundial.model.Team;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 👑 Controlador del Administrador (Tú)
 * Rutas especiales para gestionar la porra desde la interfaz, como los botones de desempate manual.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final TeamRepository teamRepository;
    private final SyncService syncService;
    private final UserAccountRepository userAccountRepository;

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        return ResponseEntity.ok(userAccountRepository.findAll());
    }

    // 🕵️‍♂️ "Chivato": Devuelve la lista de equipos a los que el Admin les ha subido puntos manualmente
    @GetMapping("/tiebreakers")
    public ResponseEntity<?> getTieBreakers() {
        Map<String, Map<String, Integer>> result = new HashMap<>();
        teamRepository.findAll().forEach(team -> {
            if (team.getGroupName() != null && team.getManualTieBreaker() != null && team.getManualTieBreaker() != 0) {
                result.computeIfAbsent(team.getGroupName(), k -> new HashMap<>())
                      .put(team.getName().replaceAll("[.#$\\[\\]]", ""), team.getManualTieBreaker());
            }
            if (team.getManualTieBreakerThirds() != null && team.getManualTieBreakerThirds() != 0) {
                result.computeIfAbsent("THIRDS", k -> new HashMap<>())
                      .put(team.getName().replaceAll("[.#$\\[\\]]", ""), team.getManualTieBreakerThirds());
            }
        });
        return ResponseEntity.ok(result);
    }

    // ⬆️ El botón verde de la tabla: Sube los "Puntos Mágicos" de un equipo para forzar que gane un empate
    @PostMapping("/bump-up")
    public ResponseEntity<?> bumpUp(@RequestParam String teamName, @RequestParam(defaultValue = "false") boolean isThirds) {
        Optional<Team> opt = teamRepository.findByName(teamName);
        if (opt.isPresent()) {
            Team team = opt.get();
            if (isThirds) {
                team.setManualTieBreakerThirds((team.getManualTieBreakerThirds() != null ? team.getManualTieBreakerThirds() : 0) + 1);
            } else {
                team.setManualTieBreaker((team.getManualTieBreaker() != null ? team.getManualTieBreaker() : 0) + 1);
            }
            teamRepository.save(team);
            return ResponseEntity.ok("Éxito: " + team.getName() + " subió en el desempate manual (+1).");
        }
        return ResponseEntity.badRequest().body("Error: Equipo no encontrado.");
    }

    // 🔄 Botón de refresco manual de resultados
    @PostMapping("/sync/refresh")
    public ResponseEntity<?> forceSync() {
        return ResponseEntity.ok(syncService.syncAll());
    }

}
