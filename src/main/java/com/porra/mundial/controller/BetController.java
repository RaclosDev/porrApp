package com.porra.mundial.controller;

import com.porra.mundial.model.Bet;
import com.porra.mundial.service.BetService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.BetResponseDTO;
import jakarta.validation.Valid;

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
    private final com.porra.mundial.service.WebSocketService webSocketService;

    /**
     * 📥 GET /api/bets
     * La web nos pide la lista de todas las porras que hay guardadas.
     * Nosotros se la mandamos traducida a un JSON que su Javascript entienda.
     */
    @GetMapping
    public List<BetResponseDTO> getAllBets(@RequestParam(required = false) Long groupId) {
        List<Bet> bets;
        if (groupId != null) {
            bets = betService.getBetsByGroupId(groupId);
        } else {
            bets = betService.getAllBets();
        }
        return betService.toBetDtoList(bets);
    }

    @GetMapping("/mine")
    public List<BetResponseDTO> getMyBets() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return betService.toBetDtoList(betService.getBetsByGoogleEmail(email));
    }

    /**
     * 📤 POST /api/bets
     * ¡Alguien le ha dado al botón "Enviar Porra"!
     * Recibimos el Nombre del participante y su predicción comprimida en "hash".
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createBet(@Valid @RequestBody BetDataDTO body, @RequestParam(required = false) Long groupId) {
        // Extraemos el email directamente del token JWT verificado
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        String betName = body.getBet();

        // We already receive groupId via @RequestParam, no need to parse from body

        // Si todo está bien, guardamos la porra
        Bet bet = betService.createBet(email, betName != null ? betName : body.getUser(), body, groupId);

        webSocketService.invalidateAndNotify();

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
    public ResponseEntity<?> updateBet(@PathVariable Long id, @Valid @RequestBody BetDataDTO body) {
        Bet bet = betService.updateBet(id, body.getUser(), body.getBet(), body);
        return ResponseEntity.ok(Map.of("id", bet.getId(), "status", "actualizada_con_exito"));
    }

    /**
     * GET /api/bets/{id}
     * Recupera una apuesta específica con todas sus predicciones relacionales.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getBet(@PathVariable Long id) {
        BetDataDTO dto = betService.getBetData(id);
        return ResponseEntity.ok(dto);
    }

    /**
     * PUT /api/bets/{id}/pay - Mark a bet as paid
     */
    @PutMapping("/{id}/pay")
    public ResponseEntity<?> markAsPaid(@PathVariable Long id) {
        betService.markAsPaid(id);
        return ResponseEntity.ok(Map.of("status", "paid"));
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
