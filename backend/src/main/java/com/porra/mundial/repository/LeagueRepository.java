package com.porra.mundial.repository;

import com.porra.mundial.model.League;
import com.porra.mundial.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio JPA para la gestión de Ligas Privadas (League).
 */
@Repository
public interface LeagueRepository extends JpaRepository<League, Long> {
    
    /**
     * Busca una liga por su código de invitación exacto.
     * @param joinCode El código alfanumérico.
     * @return Opcional de la liga encontrada.
     */
    Optional<League> findByJoinCode(String joinCode);
    
    /**
     * Busca todas las ligas administradas por un usuario específico.
     * @param adminParticipantName El participantName del usuario administrador.
     * @return Lista de ligas que administra.
     */
    List<League> findByAdminUserParticipantName(String adminParticipantName);

    /**
     * Busca ligas por nombre y usuario administrador.
     * @param name Nombre de la liga.
     * @param adminUser Usuario administrador.
     * @return Lista de ligas.
     */
    List<League> findByNameAndAdminUser(String name, UserAccount adminUser);
}
