package com.porra.mundial.service;

import com.porra.mundial.model.League;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** La caché "groupByCode" guarda las ligas encontradas pero no los códigos que no existen. */
class GroupServiceJoinCodeCacheTest {

    @Configuration
    @EnableCaching
    static class Config {
        @Bean CacheManager cacheManager() { return new ConcurrentMapCacheManager("groupByCode"); }
        @Bean LeagueRepository leagueRepository() { return mock(LeagueRepository.class); }
        @Bean PredictionRepository predictionRepository() { return mock(PredictionRepository.class); }
        @Bean UserAccountRepository userAccountRepository() {
            UserAccountRepository repo = mock(UserAccountRepository.class);
            // initDefaultGroup necesita una cuenta Admin con id para arrancar.
            when(repo.findByParticipantName("Admin"))
                    .thenReturn(Optional.of(UserAccount.builder().id(1L).googleEmail("admin@local").build()));
            return repo;
        }
        @Bean CompetitionRepository competitionRepository() { return mock(CompetitionRepository.class, RETURNS_MOCKS); }
        @Bean EditionRepository editionRepository() { return mock(EditionRepository.class, RETURNS_MOCKS); }
        @Bean MembershipRepository membershipRepository() { return mock(MembershipRepository.class); }
        @Bean MatchRepository matchRepository() { return mock(MatchRepository.class); }
        @Bean ApplicationEventPublisher eventPublisher() { return mock(ApplicationEventPublisher.class); }
        @Bean GroupService groupService(LeagueRepository leagues, PredictionRepository predictions,
                                        UserAccountRepository users, CompetitionRepository competitions,
                                        EditionRepository editions, MembershipRepository memberships,
                                        MatchRepository matches,
                                        ApplicationEventPublisher events) {
            when(leagues.save(any(League.class))).thenAnswer(inv -> {
                League l = inv.getArgument(0);
                l.setId(League.GLOBAL_ID);
                return l;
            });
            return new GroupService(leagues, predictions, users, competitions, editions, memberships,
                    matches, events);
        }
    }

    private AnnotationConfigApplicationContext context;
    private GroupService groupService;
    private LeagueRepository leagueRepository;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(Config.class);
        groupService = context.getBean(GroupService.class);
        leagueRepository = context.getBean(LeagueRepository.class);
        clearInvocations(leagueRepository);
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    @Test
    void doesNotCacheUnknownCodes() {
        when(leagueRepository.findByJoinCode("NOPE234567")).thenReturn(Optional.empty());

        assertFalse(groupService.getGroupByJoinCode("NOPE234567").isPresent());
        assertFalse(groupService.getGroupByJoinCode("NOPE234567").isPresent());

        verify(leagueRepository, times(2)).findByJoinCode("NOPE234567");
    }

    @Test
    void cachesExistingLeagues() {
        League league = League.builder().id(7L).name("Amigos").joinCode("ABCDEFGH23").build();
        when(leagueRepository.findByJoinCode("ABCDEFGH23")).thenReturn(Optional.of(league));

        assertTrue(groupService.getGroupByJoinCode("ABCDEFGH23").isPresent());
        assertTrue(groupService.getGroupByJoinCode("ABCDEFGH23").isPresent());

        verify(leagueRepository, times(1)).findByJoinCode("ABCDEFGH23");
    }
}
