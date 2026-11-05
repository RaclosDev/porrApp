package com.porra.mundial.repository;

import com.porra.mundial.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long>, UserAccountLookup {
    
    /** Usuario de una cuenta de Google, por el claim "sub" de su ID token. */
    Optional<UserAccount> findByGoogleSub(String googleSub);

    /** Implementado en {@link UserAccountRepositoryImpl}: se reutiliza dentro de la transacción. */
    @Override
    Optional<UserAccount> findByGoogleEmail(String googleEmail);

    Optional<UserAccount> findByParticipantName(String participantName);

    boolean existsByParticipantNameIgnoreCase(String participantName);

    boolean existsByParticipantNameIgnoreCaseAndIdNot(String participantName, Long id);
}
