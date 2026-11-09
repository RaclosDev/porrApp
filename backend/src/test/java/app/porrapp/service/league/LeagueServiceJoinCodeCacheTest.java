package app.porrapp.service.league;

import app.porrapp.model.League;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.UserAccountRepository;
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
import static org.mockito.Mockito.*;

/** La caché "groupByCode" guarda las ligas encontradas pero no los códigos que no existen. */
class LeagueServiceJoinCodeCacheTest {

    @Configuration
    @EnableCaching
    static class Config {
        @Bean CacheManager cacheManager() { return new ConcurrentMapCacheManager("groupByCode"); }
        @Bean LeagueRepository leagueRepository() { return mock(LeagueRepository.class); }
        @Bean PredictionRepository predictionRepository() { return mock(PredictionRepository.class); }
        @Bean UserAccountRepository userAccountRepository() { return mock(UserAccountRepository.class); }
        @Bean CompetitionRepository competitionRepository() { return mock(CompetitionRepository.class, RETURNS_MOCKS); }
        @Bean EditionRepository editionRepository() { return mock(EditionRepository.class, RETURNS_MOCKS); }
        @Bean MembershipRepository membershipRepository() { return mock(MembershipRepository.class); }
        @Bean MatchRepository matchRepository() { return mock(MatchRepository.class); }
        @Bean ApplicationEventPublisher eventPublisher() { return mock(ApplicationEventPublisher.class); }
        @Bean LeagueService leagueService(LeagueRepository leagues, PredictionRepository predictions,
                                        UserAccountRepository users, CompetitionRepository competitions,
                                        EditionRepository editions, MembershipRepository memberships,
                                        MatchRepository matches,
                                        ApplicationEventPublisher events) {
            return new LeagueService(leagues, predictions, users, competitions, editions, memberships,
                    matches, mock(app.porrapp.repository.TeamRepository.class), events);
        }
    }

    private AnnotationConfigApplicationContext context;
    private LeagueService leagueService;
    private LeagueRepository leagueRepository;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(Config.class);
        leagueService = context.getBean(LeagueService.class);
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

        assertFalse(leagueService.getLeagueByJoinCode("NOPE234567").isPresent());
        assertFalse(leagueService.getLeagueByJoinCode("NOPE234567").isPresent());

        verify(leagueRepository, times(2)).findByJoinCode("NOPE234567");
    }

    @Test
    void cachesExistingLeagues() {
        League league = League.builder().id(7L).name("Amigos").joinCode("ABCDEFGH23").build();
        when(leagueRepository.findByJoinCode("ABCDEFGH23")).thenReturn(Optional.of(league));

        assertTrue(leagueService.getLeagueByJoinCode("ABCDEFGH23").isPresent());
        assertTrue(leagueService.getLeagueByJoinCode("ABCDEFGH23").isPresent());

        verify(leagueRepository, times(1)).findByJoinCode("ABCDEFGH23");
    }
}
