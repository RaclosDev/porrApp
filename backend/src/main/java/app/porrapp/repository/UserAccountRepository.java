package app.porrapp.repository;

import app.porrapp.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long>, UserAccountLookup {
    
    /** Usuario de una cuenta de Google, por el claim "sub" de su ID token. */
    Optional<UserAccount> findByGoogleSub(String googleSub);

    /** Usuario de una cuenta de Apple, por el claim "sub" de su ID token. */
    Optional<UserAccount> findByAppleSub(String appleSub);

    /** Implementado en {@link UserAccountRepositoryImpl}: se reutiliza dentro de la transacción. */
    @Override
    Optional<UserAccount> findByGoogleEmail(String googleEmail);

    /** Si el email ya es de alguna cuenta, sin distinguir mayúsculas. */
    boolean existsByGoogleEmailIgnoreCase(String googleEmail);

    /** La cuenta de un email sin distinguir mayúsculas (hay cuentas antiguas guardadas con ellas). */
    Optional<UserAccount> findFirstByGoogleEmailIgnoreCase(String googleEmail);

    Optional<UserAccount> findByParticipantName(String participantName);

    /** Cuentas sin iniciar ni refrescar sesión desde {@code cutoff}. */
    @Query("select u.id from UserAccount u where u.lastActiveAt < :cutoff order by u.id")
    List<Long> findIdsInactiveSince(@Param("cutoff") Instant cutoff);

    boolean existsByParticipantNameIgnoreCase(String participantName);

    boolean existsByParticipantNameIgnoreCaseAndIdNot(String participantName, Long id);
}
