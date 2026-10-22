package com.porra.mundial.repository;

import com.porra.mundial.model.Bet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * ️ Repositorio de Apuestas/Porras (Bet).
 * Aquí guardamos y leemos las porras que envía la gente desde la web.
 */
@Repository
public interface BetRepository extends JpaRepository<Bet, Long> {
    
    /**
     * "Dame solo las porras que tienen un estado de pago concreto"
     * @param paymentStatus "PAID" o "PENDING".
     * @return Lista de apuestas.
     */
    List<Bet> findByPaymentStatus(String paymentStatus);
    
    /**
     * "Dame todas las porras ordenadas desde la más reciente a la más antigua"
     */
    List<Bet> findAllByOrderByCreatedAtDesc();

    /**
     * @param groupId El ID del grupo.
     * @return Las apuestas que participan en un grupo específico.
     */
    List<Bet> findByEditionLeagueId(Long groupId);

    /**
     * @param email Email de Google del usuario.
     * @return Todas las apuestas que ha enviado un usuario en cualquier grupo.
     */
    List<Bet> findByUserGoogleEmail(String email);

    /**
     * Comprueba si un usuario ya ha enviado una apuesta a un grupo concreto.
     */
    Optional<Bet> findByUserGoogleEmailAndEditionLeagueId(String email, Long groupId);

    /**
     * Usado principalmente para encontrar la apuesta especial del sistema "official"
     * que contiene el cuadro con resultados reales.
     */
    Optional<Bet> findByBetName(String betName);
}
