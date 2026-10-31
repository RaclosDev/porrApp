package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import org.springframework.data.domain.PageRequest;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository matchRepository;

    @org.springframework.cache.annotation.Cacheable("matches")
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
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime soonThreshold = now.plusMinutes(STARTING_SOON_MINUTES);
        LocalDateTime pastThreshold = now.minusHours(3).minusMinutes(30);

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
        LocalDateTime now = LocalDateTime.now();
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
