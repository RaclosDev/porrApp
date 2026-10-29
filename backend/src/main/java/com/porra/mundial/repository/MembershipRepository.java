package com.porra.mundial.repository;

import com.porra.mundial.model.Membership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio JPA para las Membresías (relación Usuario-Grupo).
 */
@Repository
public interface MembershipRepository extends JpaRepository<Membership, Membership.MembershipId> {
    
    /**
     * @param leagueId El ID del grupo (liga).
     * @return Todos los miembros de ese grupo.
     */
    List<Membership> findByLeagueId(Long leagueId);
    
    /**
     * @param userId El ID del usuario.
     * @return Las membresías vinculadas a esa cuenta de usuario.
     */
    List<Membership> findByUserId(Long userId);
}
