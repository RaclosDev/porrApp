package com.porra.mundial.service;

import com.porra.mundial.model.Match;

import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ⚽ Servicio de Partidos
 * Controla todo lo que tenga que ver con la agenda de partidos reales.
 */
@Service
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository matchRepository;

    // Dame la lista de todos los partidos del Mundial
    public List<Match> getAllMatches() {
        return matchRepository.findAll();
    }

    // Dame solo los partidos de un grupo concreto (ej. "A")
    public List<Match> getMatchesByGroup(String groupName) {
        return matchRepository.findByGroupNameOrderByMatchDateAsc(groupName);
    }

    /**
     * 🚨 "Partidos en Directo"
     * Devuelve los partidos que se están jugando AHORA mismo, 
     * o que van a empezar en menos de media hora (para ponerlos en rojo en la web).
     */
    public List<Match> getLiveMatches() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime soonThreshold = now.plusMinutes(30);

        return matchRepository.findAll().stream()
                .filter(m -> !Boolean.TRUE.equals(m.getFinished()))
                .filter(m -> m.getMatchDate() != null && m.getMatchDate().isBefore(soonThreshold))
                .sorted(Comparator.comparing(Match::getMatchDate).reversed())
                .collect(Collectors.toList());
    }

    /**
     * ⏪ "Últimos Resultados"
     * Devuelve los últimos X partidos que ya han terminado.
     */
    public List<Match> getLastMatches(int limit) {
        return matchRepository.findByFinishedTrueOrderByMatchDateDesc().stream()
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * ⏩ "Próximos Partidos"
     * Devuelve los siguientes X partidos que se van a jugar (que aún no han acabado y son en el futuro).
     */
    public List<Match> getNextMatches(int limit) {
        LocalDateTime now = LocalDateTime.now();
        return matchRepository.findByFinishedFalseOrderByMatchDateAsc().stream()
                .filter(m -> m.getMatchDate() != null && m.getMatchDate().isAfter(now))
                .limit(limit)
                .collect(Collectors.toList());
    }

    // Busca un partido por el ID raro de la FIFA
    public Optional<Match> findByExternalId(String externalId) {
        return matchRepository.findByExternalId(externalId);
    }

    // Guarda un partido modificado en la Base de Datos
    public Match save(Match match) {
        return matchRepository.save(match);
    }

    /**
     * 🌐 Traductor de Partido a JSON para la web.
     * Coge un partido de Java y lo convierte en un diccionario para que Javascript lo entienda.
     */
    public Map<String, Object> toMatchDto(Match m) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", m.getId());
        dto.put("home", m.getHomeTeam() != null ? m.getHomeTeam().getName() : "Por definir");
        dto.put("away", m.getAwayTeam() != null ? m.getAwayTeam().getName() : "Por definir");
        dto.put("homeScore", m.getHomeScore());
        dto.put("awayScore", m.getAwayScore());
        dto.put("date", m.getMatchDate() != null ? m.getMatchDate().toString() : null);
        dto.put("finished", m.getFinished());
        dto.put("round", m.getRound());
        dto.put("groupName", m.getGroupName());

        // Calculamos aquí si el partido empieza en breve (menos de 30 mins) para que la web parpadee en rojo
        if (m.getMatchDate() != null && !Boolean.TRUE.equals(m.getFinished())) {
            long diffMs = java.time.Duration.between(LocalDateTime.now(), m.getMatchDate()).toMillis();
            dto.put("isStartingSoon", diffMs > 0 && diffMs <= 30 * 60 * 1000);
        } else {
            dto.put("isStartingSoon", false);
        }

        return dto;
    }
}
