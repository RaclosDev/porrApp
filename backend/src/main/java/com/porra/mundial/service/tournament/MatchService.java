package com.porra.mundial.service.tournament;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Fight;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Sport;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.FightRepository;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository matchRepository;
    private final CompetitionRepository competitionRepository;
    private final FightRepository fightRepository;

    /** Las competiciones de una liga (cuadros personalizados) son privadas: no se listan en público. */
    public void requirePublicCompetition(Long competitionId) {
        if (competitionId != null && competitionRepository.existsByIdAndOwnerLeagueIsNotNull(competitionId)) {
            throw BusinessException.notFound("Competición no encontrada");
        }
    }

    /** Quita los partidos de competiciones privadas y de las antiguas que nadie sincroniza. */
    public List<Match> publicOnly(List<Match> matches) {
        if (matches == null || matches.isEmpty()) return List.of();
        List<Long> privateIds = competitionRepository.findHiddenCompetitionIds();
        if (privateIds == null || privateIds.isEmpty()) return matches;
        return matches.stream().filter(match -> match.getCompetition() == null
                || !privateIds.contains(match.getCompetition().getId())).toList();
    }

    /**
     * Datos de pelea de los partidos de la UFC de la lista, por id de partido. Solo lee el id de la
     * competición de cada partido: los partidos pueden venir de la caché, sin sesión abierta.
     */
    public Map<Long, Fight> fightsOf(List<Match> matches) {
        if (matches == null || matches.isEmpty()) return Map.of();
        Set<Long> competitionIds = matches.stream()
                .map(Match::getCompetition)
                .filter(Objects::nonNull)
                .map(Competition::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (competitionIds.isEmpty()) return Map.of();
        List<Long> mma = competitionRepository.findAllById(competitionIds).stream()
                .filter(Sport::isMma)
                .map(Competition::getId)
                .toList();
        if (mma.isEmpty()) return Map.of();
        return fightRepository.findByCompetitionIdIn(mma).stream()
                .collect(Collectors.toMap(Fight::getMatchId, fight -> fight, (a, b) -> a));
    }

    @org.springframework.cache.annotation.Cacheable(value = "matches", sync = true)
    public List<Match> getAllMatches() {
        return matchRepository.findAll();
    }

    public List<Match> getMatchesByCompetition(Long competitionId) {
        return matchRepository.findByCompetitionIdOrderByMatchDateAsc(competitionId);
    }

    /** Minutos antes del inicio en que un partido cuenta como «empieza pronto». */
    public static final int STARTING_SOON_MINUTES = 20;

    /** Partidos en juego o que empiezan en los próximos {@link #STARTING_SOON_MINUTES} minutos. */
    public List<Match> getLiveMatches() {
        return getLiveMatches(null);
    }

    public List<Match> getLiveMatches(Long competitionId) {
        Instant now = Instant.now();
        Instant soonThreshold = now.plus(STARTING_SOON_MINUTES, ChronoUnit.MINUTES);
        Instant pastThreshold = now.minus(3, ChronoUnit.HOURS).minus(30, ChronoUnit.MINUTES);

        return matchRepository.findRadarLive(competitionId, pastThreshold, soonThreshold,
                List.of(MatchStatusNormalized.SCHEDULED, MatchStatusNormalized.LIVE, MatchStatusNormalized.PAUSED));
    }

    public List<Match> getLastMatches(int limit) {
        return getLastMatches(limit, null);
    }

    public List<Match> getLastMatches(int limit, Long competitionId) {
        if (limit == 0) return List.of();
        return matchRepository.findRadarLast(competitionId, PageRequest.of(0, limit));
    }

    public List<Match> getNextMatches(int limit) {
        return getNextMatches(limit, null);
    }

    public List<Match> getNextMatches(int limit, Long competitionId) {
        Instant now = Instant.now();
        if (limit == 0) return List.of();
        return matchRepository.findRadarNext(competitionId, now, MatchStatusNormalized.SCHEDULED,
                PageRequest.of(0, limit));
    }

    public Optional<Match> findByExternalId(String externalId) {
        return matchRepository.findByExternalId(externalId);
    }

    @org.springframework.cache.annotation.CacheEvict(value = {"matches", "matchRadar", "standings", "officialPoints", "leaderboard"}, allEntries = true)
    @Transactional
    public Match save(Match match) {
        return matchRepository.save(match);
    }
}
