package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 *  Servicio de Partidos (MatchService).
 * Encapsula la lógica de negocio para consultar la cartelera de partidos
 * reales (finalizados, en directo o próximos).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository matchRepository;

    /**
     * @return Todo el calendario completo del torneo.
     */
    @org.springframework.cache.annotation.Cacheable("matches")
    public List<Match> getAllMatches() {
        return matchRepository.findAll();
    }

    /**
     * @param competitionId Identificador de la competición.
     * @return Todos los partidos disputados o por disputar en una competición, ordenados cronológicamente.
     */
    public List<Match> getMatchesByCompetition(Long competitionId) {
        return matchRepository.findByCompetitionIdOrderByMatchDateAsc(competitionId);
    }

    /**
     * @param groupName La letra del grupo ("A", "B").
     * @return Todos los partidos disputados o por disputar en ese grupo, ordenados cronológicamente.
     */
    public List<Match> getMatchesByGroup(String groupName) {
        return matchRepository.findByGroupNameOrderByMatchDateAsc(groupName);
    }

    /**
     * Devuelve los partidos que se están jugando AHORA MISMO,
     * o que están a punto de empezar en los próximos 20 minutos.
     */
    public List<Match> getLiveMatches() {
        return getLiveMatches(null);
    }

    public List<Match> getLiveMatches(Long competitionId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime soonThreshold = now.plusMinutes(20);
        LocalDateTime pastThreshold = now.minusHours(3).minusMinutes(30);

        return matchRepository.findAll().stream()
                .filter(m -> competitionId == null || (m.getCompetition() != null && competitionId.equals(m.getCompetition().getId())))
                .filter(m -> !Boolean.TRUE.equals(m.getFinished()))
                .filter(m -> m.getStatus() == null || m.getStatus() == MatchStatusNormalized.SCHEDULED || m.getStatus().isLive())
                .filter(m -> m.getMatchDate() != null && m.getMatchDate().isBefore(soonThreshold) && m.getMatchDate().isAfter(pastThreshold))
                .filter(m -> !isBogusMatch(m))
                .sorted(Comparator.comparing(Match::getMatchDate).reversed())
                .collect(Collectors.toList());
    }

    /**
     * @param limit Cuántos partidos devolver.
     * @return Los últimos N partidos finalizados, ideal para mostrar un resumen rápido.
     */
    public List<Match> getLastMatches(int limit) {
        return getLastMatches(limit, null);
    }

    public List<Match> getLastMatches(int limit, Long competitionId) {
        return matchRepository.findByFinishedTrueOrderByMatchDateDesc().stream()
                .filter(m -> competitionId == null || (m.getCompetition() != null && competitionId.equals(m.getCompetition().getId())))
                .filter(m -> !isBogusMatch(m))
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * @param limit Cuántos partidos devolver.
     * @return Los próximos N partidos que se jugarán en el futuro (la cartelera).
     */
    public List<Match> getNextMatches(int limit) {
        return getNextMatches(limit, null);
    }

    public List<Match> getNextMatches(int limit, Long competitionId) {
        LocalDateTime now = LocalDateTime.now();
        return matchRepository.findByFinishedFalseOrderByMatchDateAsc().stream()
                .filter(m -> m.getStatus() == null || m.getStatus() == MatchStatusNormalized.SCHEDULED)
                .filter(m -> competitionId == null || (m.getCompetition() != null && competitionId.equals(m.getCompetition().getId())))
                .filter(m -> m.getMatchDate() != null && m.getMatchDate().isAfter(now))
                .filter(m -> !isBogusMatch(m))
                .limit(limit)
                .collect(Collectors.toList());
    }

    private boolean isBogusMatch(Match m) {
        if (m.getHomeTeam() == null || m.getAwayTeam() == null) {
            return false;
        }
        boolean homeBogus = "Por definir".equalsIgnoreCase(m.getHomeTeam().getName())
                || "TBD".equalsIgnoreCase(m.getHomeTeam().getName())
                || "TBD".equalsIgnoreCase(m.getHomeTeam().getNameEn());
        boolean awayBogus = "Por definir".equalsIgnoreCase(m.getAwayTeam().getName())
                || "TBD".equalsIgnoreCase(m.getAwayTeam().getName())
                || "TBD".equalsIgnoreCase(m.getAwayTeam().getNameEn());
        return homeBogus && awayBogus;
    }

    /**
     * Busca un partido por el ID de la API remota (ESPN).
     */
    public Optional<Match> findByExternalId(String externalId) {
        return matchRepository.findByExternalId(externalId);
    }

    /**
     * Guarda o actualiza un partido en base de datos.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"matches", "matchRadar", "standings", "officialPoints", "leaderboard", "rebuiltBetData", "allBetsDto", "allPredictionsDto", "myBetsDto", "allPredictionsDto", "myPredictionsDto"}, allEntries = true)
    @Transactional
    public Match save(Match match) {
        return matchRepository.save(match);
    }
}
