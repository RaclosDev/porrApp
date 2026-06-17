package com.porra.mundial.service;

import com.porra.mundial.model.Bet;
import com.porra.mundial.repository.BetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 🛠️ Servicio de Apuestas
 * Es el "cerebro" que se encarga de gestionar las porras que envía la gente.
 * Aquí validamos cosas antes de guardarlas en la base de datos o prepararlas para la web.
 */
@Service
@RequiredArgsConstructor
public class BetService {

    private final BetRepository betRepository;

    // Recupera todas las porras desde el disco duro
    public List<Bet> getAllBets() {
        return betRepository.findAllByOrderByCreatedAtDesc();
    }

    // Recupera solo las porras que ya han pagado
    public List<Bet> getPaidBets() {
        return betRepository.findByPaidTrue();
    }

    // Busca una porra concreta por su ID
    public Optional<Bet> findById(Long id) {
        return betRepository.findById(id);
    }

    // Crea una porra nueva desde cero cuando alguien le da a "Enviar" en la web
    public Bet createBet(String participantName, String betName, String hash) {
        Bet bet = Bet.builder()
                .participantName(participantName)
                .betName(betName)
                .hash(hash)
                .paid(false) // Por defecto, nadie paga hasta que el admin lo diga
                .createdAt(LocalDateTime.now())
                .build();
        return betRepository.save(bet);
    }

    // Permite al admin corregir un nombre o actualizar el hash de una porra si hubo un error
    public Bet updateBet(Long id, String participantName, String betName, String hash) {
        Bet bet = betRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        if (participantName != null) bet.setParticipantName(participantName);
        if (betName != null) bet.setBetName(betName);
        if (hash != null) bet.setHash(hash);
        return betRepository.save(bet);
    }

    // ¡Bling! Marca que un usuario ya ha hecho su bizum de 10 euritos
    public Bet markAsPaid(Long id) {
        Bet bet = betRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        bet.setPaid(true);
        return betRepository.save(bet);
    }

    // Elimina una porra si era spam o repetida
    public void deleteBet(Long id) {
        betRepository.deleteById(id);
    }

    /**
     * 🌐 Este método es un "traductor".
     * Coge el formato feo de la base de datos (Java) y lo convierte en un 
     * diccionario amigable (JSON) que JavaScript puede entender a la perfección.
     */
    public List<Map<String, Object>> toBetDtoList(List<Bet> bets) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Bet bet : bets) {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("key", bet.getId().toString());
            dto.put("hash", bet.getHash());
            dto.put("paid", bet.getPaid());
            dto.put("participantName", bet.getParticipantName());
            dto.put("betName", bet.getBetName());
            result.add(dto);
        }
        return result;
    }
}
