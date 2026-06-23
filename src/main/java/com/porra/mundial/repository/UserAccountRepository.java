package com.porra.mundial.repository;

import com.porra.mundial.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    
    // Buscar cuenta por email de Google
    Optional<UserAccount> findByGoogleEmail(String googleEmail);

    Optional<UserAccount> findByParticipantNameIgnoreCase(String participantName);
    Optional<UserAccount> findByParticipantName(String participantName);

    // Buscar si un nombre de participante ya está pillado
    boolean existsByParticipantNameIgnoreCase(String participantName);

    // Obtener todos los nombres reclamados (que no sean cuentas autogeneradas pendientes de vincular)
    @org.springframework.data.jpa.repository.Query("SELECT u.participantName FROM UserAccount u WHERE u.googleEmail NOT LIKE '%@auto.generated'")
    java.util.List<String> findAllClaimedNames();
}
