package com.porra.mundial.repository;

import com.porra.mundial.model.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * 🗄️ Repositorio de Partidos
 * Aquí le pedimos datos a la Base de Datos sin necesidad de escribir código SQL.
 * Spring Boot adivina qué queremos hacer simplemente leyendo el nombre del método en inglés. ¡Magia!
 */
@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {
    
    // "Búscame los partidos del Grupo A, ordenados por fecha"
    List<Match> findByGroupNameOrderByMatchDateAsc(String groupName);
    
    // "Búscame los partidos que ya han terminado (Finished=True), ordenados de más recientes a más antiguos"
    List<Match> findByFinishedTrueOrderByMatchDateDesc();
    
    // "Búscame los partidos que aún no han terminado, ordenados por los más próximos a jugarse"
    List<Match> findByFinishedFalseOrderByMatchDateAsc();
    
    // "Búscame los partidos de una ronda en concreto (ej. 'r16' para Octavos)"
    List<Match> findByRoundOrderByMatchDateAsc(String round);
    
    // "Búscame un partido usando el ID raro de la API externa para no crear duplicados"
    Optional<Match> findByExternalId(String externalId);
}
