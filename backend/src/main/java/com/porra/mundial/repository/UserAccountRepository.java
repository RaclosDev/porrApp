package com.porra.mundial.repository;

import com.porra.mundial.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repositorio JPA para la entidad UserAccount (Gestión de SSO de Google y Perfiles).
 */
@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    
    /** Usuario de una cuenta de Google, por el claim "sub" de su ID token. */
    Optional<UserAccount> findByGoogleSub(String googleSub);

    /**
     * Buscar cuenta vinculada a un email de Google específico.
     */
    Optional<UserAccount> findByGoogleEmail(String googleEmail);

    /**
     * Busca por nombre de participante ignorando mayúsculas/minúsculas.
     */
    Optional<UserAccount> findByParticipantNameIgnoreCase(String participantName);
    
    /**
     * Busca por nombre de participante exacto.
     */
    Optional<UserAccount> findByParticipantName(String participantName);

    /**
     * Comprobar de forma rápida si un nombre de participante ya está pillado.
     */
    boolean existsByParticipantNameIgnoreCase(String participantName);

    /**
     * Comprueba si otro usuario distinto del indicado ya usa ese nombre (sin distinguir mayúsculas).
     */
    boolean existsByParticipantNameIgnoreCaseAndIdNot(String participantName, Long id);
}
