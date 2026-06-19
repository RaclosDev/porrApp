package com.porra.mundial.controller;

import com.porra.mundial.model.Bet;
import com.porra.mundial.service.BetService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * 🎫 Controlador de Apuestas
 * Es la puerta de entrada para todo lo relacionado con enviar porras.
 * Recibe los datos desde la web y los manda al BetService para que los procese.
 */
@RestController
@RequestMapping("/api/bets")
@RequiredArgsConstructor
public class BetController {

    private final BetService betService;
    private final org.springframework.cache.CacheManager cacheManager;
    private final com.porra.mundial.service.SseService sseService;

    /**
     * 📥 GET /api/bets
     * La web nos pide la lista de todas las porras que hay guardadas.
     * Nosotros se la mandamos traducida a un JSON que su Javascript entienda.
     */
    @GetMapping
    public List<Map<String, Object>> getAllBets(@RequestParam(required = false) Long groupId) {
        List<Bet> bets;
        if (groupId != null) {
            bets = betService.getBetsByGroupId(groupId);
        } else {
            bets = betService.getAllBets();
        }
        return betService.toBetDtoList(bets);
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> getMyBets() {
        String participantName = SecurityContextHolder.getContext().getAuthentication().getName();
        return betService.toBetDtoList(betService.getBetsByParticipantName(participantName));
    }

    /**
     * 📤 POST /api/bets
     * ¡Alguien le ha dado al botón "Enviar Porra"!
     * Recibimos el Nombre del participante y su predicción comprimida en "hash".
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createBet(@RequestBody Map<String, String> body) {
        // Extraemos el nombre directamente del token JWT verificado (¡Imposible suplantar!)
        String participantName = SecurityContextHolder.getContext().getAuthentication().getName();
        String betName = body.get("betName");
        String hash = body.get("hash");

        if (hash == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "El hash es obligatorio"));
        }

        Long groupId = null;
        if (body.get("groupId") != null) {
            try {
                groupId = Long.parseLong(body.get("groupId"));
            } catch (NumberFormatException e) {
                // Ignore invalid groupId
            }
        }

        // Si todo está bien, guardamos la porra
        Bet bet = betService.createBet(participantName, betName != null ? betName : participantName, hash, groupId);

        org.springframework.cache.Cache cache = cacheManager.getCache("leaderboard");
        if (cache != null) cache.clear();
        sseService.broadcastUpdate("DATA_UPDATED");

        return ResponseEntity.ok(Map.of(
                "id", bet.getId(),
                "participantName", bet.getParticipantName(),
                "groupId", bet.getGroupId() != null ? bet.getGroupId().toString() : "",
                "status", "creada_con_exito"
        ));
    }

    /**
     * ✏️ PUT /api/bets/{id}
     * El admin quiere editar a mano el nombre o la apuesta de una porra en concreto.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateBet(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            Bet bet = betService.updateBet(id, body.get("participantName"), body.get("betName"), body.get("hash"));
            return ResponseEntity.ok(Map.of("id", bet.getId(), "status", "actualizada_con_exito"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build(); // Si la porra no existe, devolvemos un 404
        }
    }

    /**
     * PUT /api/bets/{id}/pay - Mark a bet as paid
     */
    @PutMapping("/{id}/pay")
    public ResponseEntity<?> markAsPaid(@PathVariable Long id) {
        try {
            betService.markAsPaid(id);
            return ResponseEntity.ok(Map.of("status", "paid"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * DELETE /api/bets/{id} - Delete a bet
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBet(@PathVariable Long id) {
        betService.deleteBet(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }
}
