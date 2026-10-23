package com.porra.mundial.controller;

import com.porra.mundial.model.Bet;

import com.porra.mundial.service.PredictionService;

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
 *  Controlador REST Principal para las Apuestas (Porras).
 * Constituye el puente entre la interfaz de usuario de React y la lógica de negocio en el Backend.
 * Permite listar, crear, modificar y eliminar las apuestas de los usuarios.
 */

@RestController

@RequestMapping({"/api/bets", "/api/predictions"})

@RequiredArgsConstructor

public class BetController {

    private final PredictionService predictionService;

    private final com.porra.mundial.service.WebSocketService webSocketService;

    /**
     *  GET /api/bets
     * Recupera todas las apuestas almacenadas en la base de datos.
     * Si se le pasa el query param `groupId`, devuelve únicamente las apuestas pertenecientes a ese grupo específico.
     * 
     * @param groupId (Opcional) El ID del grupo para filtrar las apuestas.
     * @return Una lista de apuestas formateadas como BetResponseDTO para la vista de la web.
     */

    @GetMapping

    @org.springframework.cache.annotation.Cacheable(value = "allBetsDto", key = "#groupId != null ? #groupId : 'ALL'")

    public List<BetResponseDTO> getAllBets(@RequestParam(required = false) Long groupId) {

        List<Bet> bets;

        if (groupId != null) {

            // Filtro por grupo (ej: Grupo de amigos de Carlos)

            bets = predictionService.getBetsByGroupId(groupId);

        } else {

            // Si no se aporta groupId, por seguridad devolvemos las apuestas del grupo global (ID 1)

            // salvo que sea un superadministrador solicitando el volcado completo

            String email = SecurityContextHolder.getContext().getAuthentication() != null

                    ? SecurityContextHolder.getContext().getAuthentication().getName() : null;

            if (predictionService.isSuperAdmin(email)) {

                bets = predictionService.getAllBets();

            } else {

                bets = predictionService.getBetsByGroupId(1L);

            }

        }

        return predictionService.toBetDtoList(bets);

    }

    /**
     *  GET /api/bets/mine
     * Recupera exclusivamente las apuestas creadas por el usuario que hace la petición.
     * Lee la identidad automáticamente a través del Token JWT verificado.
     * 
     * @return Lista de BetResponseDTO pertenecientes al usuario conectado.
     */

    @GetMapping("/mine")

    @org.springframework.cache.annotation.Cacheable(value = "myBetsDto", key = "T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName()")

    public List<BetResponseDTO> getMyBets() {

        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        return predictionService.toBetDtoList(predictionService.getBetsByGoogleEmail(email));

    }

    /**
     *  POST /api/bets
     * Endpoint crítico activado al pulsar "Enviar Porra" en la interfaz.
     * Guarda la predicción completa de un usuario en un grupo determinado.
     * 
     * @param body Payload JSON validado con el objeto DTO contenedor de toda la estructura de la porra.
     * @param groupId ID del grupo en el que participa la apuesta.
     * @return Objeto JSON con el estado de creación y el ID asignado a la nueva apuesta.
     */

    @PostMapping

    public ResponseEntity<Map<String, Object>> createBet(@Valid @RequestBody BetDataDTO body, @RequestParam(required = false) Long groupId) {

        // Obtenemos el email directamente del contexto de Spring Security para garantizar identidad

        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        String betName = body.getBet();

        // Creamos la apuesta y todo su árbol de predicciones (Bracket, Groups, Extras) a través del BetService

        Bet bet = predictionService.createBet(email, betName != null ? betName : body.getUser(), body, groupId);

        // Notifica por WebSocket a todos los clientes que hay una nueva apuesta (actualiza vistas en tiempo real)

        webSocketService.invalidateAndNotify();

        return ResponseEntity.ok(Map.of(

                "id", bet.getId(),

                "participantName", bet.getParticipantName(),

                "groupId", bet.getGroupId() != null ? bet.getGroupId().toString() : "",

                "status", "creada_con_exito"

        ));

    }

    /**
     * ️ PUT /api/bets/{id}
     * Permite a un administrador modificar o sobreescribir la predicción de una apuesta existente
     * en caso de algún error técnico (por ejemplo, si el usuario la mandó mal y pidió corrección).
     * 
     * @param id Identificador de la apuesta en base de datos.
     * @param body Payload JSON actualizado de la apuesta.
     * @return OK si fue actualizada con éxito.
     */

        private String getRequesterEmail(java.security.Principal principal) {
        if (principal != null && principal.getName() != null) {
            return principal.getName();
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null) ? auth.getName() : null;
    }

@PutMapping("/{id}")

    public ResponseEntity<?> updateBet(@PathVariable Long id, @Valid @RequestBody BetDataDTO body, java.security.Principal principal) {
        String email = getRequesterEmail(principal);

        Bet bet = predictionService.updateBet(id, email, body.getUser(), body.getBet(), body);

        return ResponseEntity.ok(Map.of("id", bet.getId(), "status", "actualizada_con_exito"));

    }

    /**
     *  GET /api/bets/{id}
     * Recupera una apuesta específica con todo su árbol de relaciones (Predicciones, Cruces, etc.)
     * Recompone los datos relacionales al formato JSON que React sabe dibujar.
     * 
     * @param id ID de la apuesta.
     * @return BetDataDTO (Objeto complejo de datos compatible con React Bracket).
     */

    @GetMapping("/{id}")

    public ResponseEntity<?> getBet(@PathVariable Long id) {

        BetDataDTO dto = predictionService.getBetData(id);

        return ResponseEntity.ok(dto);

    }

    /**
     *  PUT /api/bets/{id}/pay
     * Marca manualmente una apuesta como 'PAGADA' (PAID) por el administrador del grupo.
     * Afecta a su visibilidad o elegibilidad en la clasificación general.
     * 
     * @param id Identificador de la apuesta.
     * @return Confirmación de actualización de estado.
     */

    @PutMapping("/{id}/pay")

    public ResponseEntity<?> markAsPaid(@PathVariable Long id, java.security.Principal principal) {
        String email = getRequesterEmail(principal);

        predictionService.markAsPaid(id, email);

        return ResponseEntity.ok(Map.of("status", "paid"));

    }

    /**
     * ️ DELETE /api/bets/{id}
     * Elimina completamente la apuesta y sus predicciones en cascada.
     * 
     * @param id Identificador de la apuesta a eliminar.
     * @return Confirmación de eliminación.
     */

    @DeleteMapping("/{id}")

    public ResponseEntity<?> deleteBet(@PathVariable Long id, java.security.Principal principal) {
        String email = getRequesterEmail(principal);

        predictionService.deleteBet(id, email);

        return ResponseEntity.ok(Map.of("status", "deleted"));

    }

}