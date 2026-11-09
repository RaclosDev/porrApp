package app.porrapp.repository;

import app.porrapp.model.League;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeagueRepository extends JpaRepository<League, Long> {
    
    Optional<League> findByJoinCode(String joinCode);

    // Consultas explícitas: con el getter transitorio League#getAdminUserId, la consulta derivada
    // de «AdminUserId» se resolvía como un atributo inexistente y fallaba al ejecutarse.

    /** Liga que creó el administrador con esa clave de idempotencia. */
    @Query("SELECT l FROM League l WHERE l.adminUser.id = :adminUserId AND l.creationKey = :creationKey")
    Optional<League> findByAdminUserIdAndCreationKey(@Param("adminUserId") Long adminUserId,
                                                     @Param("creationKey") String creationKey);

    /** Ligas que administra el usuario. */
    @Query("SELECT l FROM League l WHERE l.adminUser.id = :adminUserId")
    List<League> findByAdminUserId(@Param("adminUserId") Long adminUserId);

    /** La liga que repite a esa para la temporada siguiente; como mucho hay una. */
    Optional<League> findByPreviousLeagueId(Long previousLeagueId);

    /** La liga con su fila bloqueada hasta el final de la transacción: quien llega después, espera. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM League l WHERE l.id = :id")
    Optional<League> findWithLockById(@Param("id") Long id);

    /** La liga pública más antigua: la que se enseña en la portada y en la demo. */
    Optional<League> findFirstByPublicLeagueTrueOrderByIdAsc();
}
