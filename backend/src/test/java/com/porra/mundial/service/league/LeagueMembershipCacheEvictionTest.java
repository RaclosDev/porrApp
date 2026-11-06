package com.porra.mundial.service.league;

import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Las altas y bajas solo vacían el ranking de su liga y la lista de ligas de quien entra o sale. */
class LeagueMembershipCacheEvictionTest {

    @Configuration
    @EnableCaching
    static class Config {
        @Bean CacheManager cacheManager() {
            return new ConcurrentMapCacheManager("leaderboard", "userGroups", "groupById", "groupByCode");
        }
        @Bean UserAccountRepository userAccountRepository() { return mock(UserAccountRepository.class); }
        @Bean LeagueRepository leagueRepository() { return mock(LeagueRepository.class); }
        @Bean LeagueMembershipService membershipService(UserAccountRepository users, LeagueRepository leagues) {
            return new LeagueMembershipService(leagues, users, mock(MembershipRepository.class),
                    mock(PredictionRepository.class), mock(ApplicationEventPublisher.class),
                    mock(LeaguePaymentService.class));
        }
    }

    private AnnotationConfigApplicationContext context;
    private LeagueMembershipService membershipService;
    private Cache leaderboard;
    private Cache userGroups;
    private Cache groupById;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(Config.class);
        membershipService = context.getBean(LeagueMembershipService.class);
        when(context.getBean(UserAccountRepository.class).findByGoogleEmail(any())).thenReturn(Optional.empty());
        when(context.getBean(LeagueRepository.class).findById(any())).thenReturn(Optional.empty());
        CacheManager caches = context.getBean(CacheManager.class);
        leaderboard = caches.getCache("leaderboard");
        userGroups = caches.getCache("userGroups");
        groupById = caches.getCache("groupById");
        leaderboard.put(7L, "ranking 7");
        leaderboard.put(8L, "ranking 8");
        userGroups.put("ana@test.com", "ligas de ana");
        userGroups.put("bea@test.com", "ligas de bea");
        groupById.put(7L, "liga 7");
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    @Test
    void joiningEvictsOnlyThatLeagueAndThatUser() {
        membershipService.join(7L, "ana@test.com");

        assertThat(leaderboard.get(7L)).isNull();
        assertThat(leaderboard.get(8L)).isNotNull();
        assertThat(userGroups.get("ana@test.com")).isNull();
        assertThat(userGroups.get("bea@test.com")).isNotNull();
        assertThat(groupById.get(7L)).isNotNull();
    }
}
