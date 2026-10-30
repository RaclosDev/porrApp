package com.porra.mundial.service;

import com.porra.mundial.model.Team;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

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

        return matchRepository.findAll().stream()
                .filter(m -> competitionId == null || (m.getCompetition() != null && competitionId.equals(m.getCompetition().getId())))
                .filter(m -> !Boolean.TRUE.equals(m.getFinished()))
                .filter(m -> m.getStatus() == null || m.getStatus() == MatchStatusNormalized.SCHEDULED || m.getStatus().isLive())
                .filter(m -> m.getMatchDate() != null && m.getMatchDate().isBefore(soonThreshold) && m.getMatchDate().isAfter(pastThreshold))
                .filter(m -> !isBogusMatch(m))
                .sorted(Comparator.comparing(Match::getMatchDate).reversed())
                .collect(Collectors.toList());
    }

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
        boolean homeBogus = Team.isPlaceholder(m.getHomeTeam());
        boolean awayBogus = Team.isPlaceholder(m.getAwayTeam());
        return homeBogus && awayBogus;
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
