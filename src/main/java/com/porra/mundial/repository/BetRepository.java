package com.porra.mundial.repository;

import com.porra.mundial.model.Bet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * 🗄️ Repositorio de Apuestas/Porras
 * Aquí guardamos y leemos las porras que envía la gente desde la web.
 */
@Repository
public interface BetRepository extends JpaRepository<Bet, Long> {
    
    // "Dame solo las porras de la gente que ya ha pagado"
    List<Bet> findByPaymentStatus(String paymentStatus);
    
    // "Dame todas las porras ordenadas desde la más reciente a la más antigua"
    List<Bet> findAllByOrderByCreatedAtDesc();

    List<Bet> findByEditionLeagueId(Long groupId);

    List<Bet> findByUserGoogleEmail(String email);

    Optional<Bet> findByUserGoogleEmailAndEditionLeagueId(String email, Long groupId);

    Optional<Bet> findByBetName(String betName);
}
