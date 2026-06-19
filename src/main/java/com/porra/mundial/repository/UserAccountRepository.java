package com.porra.mundial.repository;

import com.porra.mundial.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    
    // Buscar cuenta por email de Google
    Optional<UserAccount> findByGoogleEmail(String googleEmail);

    // Buscar si un nombre de participante ya está pillado
    boolean existsByParticipantNameIgnoreCase(String participantName);

    // Obtener todos los nombres reclamados
    @org.springframework.data.jpa.repository.Query("SELECT u.participantName FROM UserAccount u")
    java.util.List<String> findAllClaimedNames();
}
