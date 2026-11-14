package app.porrapp.service.sync;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.EditionMatchChoice;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchPrediction;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionMatchChoiceRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.sync.CompetitionSeasonService.Season;
import app.porrapp.sports.SportsDataProvider.SeasonWindow;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Temporadas de una competición contra Postgres real: etiqueta, fila vigente, fila archivada y cambio de temporada. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({CompetitionSeasonService.class, ScoreInvalidationService.class, CompetitionSeasonServiceTest.Caches.class})
class CompetitionSeasonServiceTest {

    @TestConfiguration
    static class Caches {
        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager();
        }
    }

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = app.porrapp.SharedPostgres.committing();

    private static final Season SEASON_26_27 = Season.of(new SeasonWindow("2026-08-14T04:00Z", "2027-06-01T03:59Z"));

    /** La temporada que el proveedor da por vigente en los cambios de temporada: empezó hace diez días. */
    private static final Instant START = Instant.now().minus(Duration.ofDays(10));
    private static final Instant END = START.plus(Duration.ofDays(300));
    private static final Season NEXT = new Season(CompetitionSeasonService.labelOf(START, END), START, END);
    /** La anterior, ya anotada en la fila. */
    private static final String PREVIOUS = String.valueOf(NEXT.startYear() - 1);

    @Autowired private TestEntityManager em;
    @Autowired private CompetitionRepository competitions;
    @Autowired private MatchRepository matches;
    @Autowired private MatchPredictionRepository matchPredictions;
    @Autowired private EditionMatchChoiceRepository matchChoices;
    @Autowired private CacheManager caches;
    @Autowired private CompetitionSeasonService seasons;

    @AfterEach
    void rolloverBackOn() {
        ReflectionTestUtils.setField(seasons, "rolloverEnabled", true);
    }

    /** Fila con la temporada anterior anotada y jugada entera. */
    private Competition played(String externalId) {
        Competition row = em.persistFlushFind(Competition.builder().name("Liga de prueba").externalId(externalId)
                .formatType("LEAGUE").season(PREVIOUS).build());
        played(row, START.minus(Duration.ofDays(200)));
        played(row, START.minus(Duration.ofDays(40)));
        return row;
    }

    private Match played(Competition competition, Instant date) {
        return match(competition, date, true, MatchStatusNormalized.FINISHED);
    }

    private Match match(Competition competition, Instant date, boolean finished, MatchStatusNormalized status) {
        return em.persistAndFlush(Match.builder().competition(competition).matchDate(date).finished(finished)
                .status(status).build());
    }

    private Competition reload(Competition competition) {
        em.flush();
        em.clear();
        return competitions.findById(competition.getId()).orElseThrow();
    }

    /** Comprueba que la fila sigue siendo la vigente y la única de su competición. */
    private void assertStays(Competition row, Season season) {
        Competition entered = seasons.enterSeason(row.getId(), season);

        assertThat(entered.getId()).as(row.getExternalId()).isEqualTo(row.getId());
        assertThat(reload(row).isArchived()).as(row.getExternalId()).isFalse();
        assertThat(competitions.findByExternalId(row.getExternalId())).map(Competition::getId).contains(row.getId());
    }

    private Competition competition(String externalId, Instant archivedAt) {
        return em.persistFlushFind(Competition.builder().name("Liga de prueba").externalId(externalId)
                .archivedAt(archivedAt).build());
    }

    private void match(Competition competition, String date) {
        em.persistAndFlush(Match.builder().competition(competition).matchDate(Instant.parse(date)).build());
    }

    private String seasonOf(Competition competition) {
        em.flush();
        em.clear();
        return competitions.findById(competition.getId()).orElseThrow().getSeason();
    }

    @Test
    @DisplayName("La etiqueta es «2026/27» si la temporada cruza el año y «2026» si cabe en uno")
    void labelsASeasonByItsYears() {
        assertThat(SEASON_26_27.label()).isEqualTo("2026/27");
        assertThat(Season.of(new SeasonWindow("2026-02-21T05:00Z", "2026-12-06T04:59Z")).label()).isEqualTo("2026");
        // El proveedor cierra el año natural en la madrugada del 1 de enero: sigue siendo 2026.
        assertThat(Season.of(new SeasonWindow("2026-01-01T10:00Z", "2027-01-01T04:59Z")).label()).isEqualTo("2026");
        assertThat(Season.ofYear(2026).label()).isEqualTo("2026");
    }

    @Test
    @DisplayName("Un torneo corto que pilla el cambio de año es del año en que cae su mitad")
    void aShortTournamentBelongsToASingleYear() {
        assertThat(Season.of(new SeasonWindow("2026-12-28T00:00Z", "2027-01-12T00:00Z")).label()).isEqualTo("2027");
        assertThat(Season.of(new SeasonWindow("2026-12-10T00:00Z", "2027-01-03T00:00Z")).label()).isEqualTo("2026");
    }

    @Test
    @DisplayName("Sin fechas, con fechas que no se entienden o con una temporada de años no hay temporada")
    void aStrangeSeasonIsNoSeason() {
        assertThat(Season.of(null)).isNull();
        assertThat(Season.of(new SeasonWindow("no es fecha", "2027-01-01T00:00Z"))).isNull();
        assertThat(Season.of(new SeasonWindow("2027-01-01T00:00Z", "2026-01-01T00:00Z"))).isNull();
        assertThat(Season.of(new SeasonWindow("2020-01-01T00:00Z", "2030-01-01T00:00Z"))).isNull();
        // Los playoffs de la NBA importan desde antes; si no dicen cuándo empieza su temporada, no se sabe.
        assertThat(Season.of(new SeasonWindow("2026-04-01T00:00Z", "2027-06-20T00:00Z", null))).isNull();
    }

    @Test
    @DisplayName("La temporada empieza donde dice el proveedor, no donde empieza lo que se importa")
    void theSeasonStartsWhereTheProviderSays() {
        Season playoffs = Season.of(new SeasonWindow("2026-04-01T00:00Z", "2027-06-20T00:00Z", "2026-10-01T07:00Z"));

        assertThat(playoffs.label()).isEqualTo("2026/27");
        assertThat(playoffs.start()).isEqualTo(Instant.parse("2026-10-01T07:00:00Z"));
    }

    @Test
    @DisplayName("Anota la temporada en una fila sin partidos o con partidos de esa temporada")
    void annotatesARowOfThatSeason() {
        Competition empty = competition("test.vacia", null);
        Competition playing = competition("test.en-juego", null);
        // Una ronda previa unos días antes del calendario del proveedor sigue siendo de la temporada.
        match(playing, "2026-08-01T18:00:00Z");
        match(playing, "2027-05-30T18:00:00Z");

        assertThat(seasons.annotate(empty.getId(), SEASON_26_27)).isTrue();
        assertThat(seasons.annotate(playing.getId(), SEASON_26_27)).isTrue();

        assertThat(seasonOf(empty)).isEqualTo("2026/27");
        assertThat(seasonOf(playing)).isEqualTo("2026/27");
    }

    @Test
    @DisplayName("Una fila que guarda partidos de otra temporada se queda sin anotar")
    void leavesARowOfAnotherSeasonUnlabelled() {
        Competition previous = competition("test.anterior", null);
        match(previous, "2026-05-24T18:00:00Z");
        Competition mixed = competition("test.mezcla", null);
        match(mixed, "2026-05-24T18:00:00Z");
        match(mixed, "2026-09-12T18:00:00Z");
        Competition next = competition("test.siguiente", null);
        match(next, "2027-09-12T18:00:00Z");

        for (Competition row : List.of(previous, mixed, next)) {
            assertThat(seasons.annotate(row.getId(), SEASON_26_27)).as(row.getExternalId()).isFalse();
            assertThat(seasonOf(row)).as(row.getExternalId()).isNull();
        }
    }

    @Test
    @DisplayName("No cambia una temporada ya anotada, ni toca una archivada, una personalizada o un dato raro")
    void neverChangesAnAnnotatedSeason() {
        Competition labelled = competition("test.anotada", null);
        assertThat(seasons.annotate(labelled.getId(), SEASON_26_27)).isTrue();
        Competition archived = competition("test.archivada", Instant.parse("2026-07-01T00:00:00Z"));
        UserAccount admin = em.persistFlushFind(UserAccount.builder().googleEmail("temporadas@test.invalid")
                .googleName("Temporadas").participantName("Temporadas").build());
        League league = em.persistFlushFind(League.builder().name("Temporadas").joinCode("TEMPORADA").adminUser(admin).build());
        Competition custom = em.persistFlushFind(Competition.builder().name("Torneo del barrio").ownerLeague(league).build());
        Competition unknown = competition("test.sin-dato", null);

        assertThat(seasons.annotate(labelled.getId(), Season.ofYear(2030))).isFalse();
        assertThat(seasons.annotate(archived.getId(), SEASON_26_27)).isFalse();
        assertThat(seasons.annotate(custom.getId(), SEASON_26_27)).isFalse();
        assertThat(seasons.annotate(unknown.getId(), null)).isFalse();
        assertThat(seasons.annotate(-1L, SEASON_26_27)).isFalse();

        assertThat(seasonOf(labelled)).isEqualTo("2026/27");
        assertThat(seasonOf(archived)).isNull();
        assertThat(seasonOf(custom)).isNull();
        assertThat(seasonOf(unknown)).isNull();
    }

    @Test
    @DisplayName("Con una temporada más nueva y la guardada ya jugada, archiva la fila y crea la de la nueva")
    void rollsOverToANewerSeason() {
        Competition old = played("test.cambio");

        Competition next = seasons.enterSeason(old.getId(), NEXT);

        assertThat(next.getId()).isNotEqualTo(old.getId());
        assertThat(next.getSeason()).isEqualTo(NEXT.label());
        assertThat(next.getExternalId()).isEqualTo("test.cambio");
        assertThat(next.getName()).isEqualTo("Liga de prueba");
        assertThat(next.getFormatType()).isEqualTo("LEAGUE");
        assertThat(next.isArchived()).isFalse();
        Competition archived = reload(old);
        assertThat(archived.isArchived()).isTrue();
        assertThat(archived.getSeason()).isEqualTo(PREVIOUS);
        assertThat(competitions.findByExternalId("test.cambio")).map(Competition::getId).contains(next.getId());
        // Lo jugado se queda con la temporada que lo jugó.
        assertThat(matches.countByCompetitionId(old.getId())).isEqualTo(2);
        assertThat(matches.countByCompetitionId(next.getId())).isZero();
    }

    @Test
    @DisplayName("Los partidos ya importados de la temporada nueva pasan a su fila, sin lo predicho sobre ellos")
    void movesTheNewSeasonMatchesWithoutTheirPredictions() {
        Competition old = played("test.mueve");
        Match last = played(old, START.minus(Duration.ofDays(20)));
        Match opener = match(old, START.plus(Duration.ofDays(5)), false, MatchStatusNormalized.SCHEDULED);
        UserAccount user = em.persistFlushFind(UserAccount.builder().googleEmail("cambio@test.invalid")
                .googleName("Cambio").participantName("Cambio").build());
        League league = em.persistFlushFind(League.builder().name("Cambio").joinCode("CAMBIOTEMP").adminUser(user).build());
        Edition edition = em.persistFlushFind(Edition.builder().league(league).competition(old)
                .poolFormat(PoolFormat.MATCH_DAY).build());
        Prediction prediction = em.persistFlushFind(Prediction.builder().name("Cambio").user(user).edition(edition)
                .scoreCalculatedAt(Instant.now()).build());
        MatchPrediction kept = em.persistAndFlush(MatchPrediction.builder().prediction(prediction).match(last)
                .homeScore(2).awayScore(1).pointsAwarded(3).build());
        em.persistAndFlush(MatchPrediction.builder().prediction(prediction).match(opener).homeScore(0).awayScore(0).build());
        em.persistAndFlush(new EditionMatchChoice(new EditionMatchChoice.Key(edition.getId(), opener.getId()), true));
        em.persistAndFlush(new EditionMatchChoice(new EditionMatchChoice.Key(edition.getId(), last.getId()), false));

        Competition next = seasons.enterSeason(old.getId(), NEXT);
        em.flush();
        em.clear();

        assertThat(matches.findByCompetitionId(next.getId())).extracting(Match::getId).containsExactly(opener.getId());
        assertThat(matches.countByCompetitionId(old.getId())).isEqualTo(3);
        // La liga termina con su temporada: conserva lo predicho sobre ella y pierde lo de la siguiente.
        assertThat(matchPredictions.findByPredictionId(prediction.getId())).extracting(MatchPrediction::getId)
                .containsExactly(kept.getId());
        assertThat(matchChoices.findByEditionId(edition.getId())).extracting(choice -> choice.getId().getMatchId())
                .containsExactly(last.getId());
        // Y su clasificación se vuelve a calcular sin esos partidos.
        assertThat(em.find(Prediction.class, prediction.getId()).getScoreCalculatedAt()).isNull();
        // La liga sigue en la fila archivada.
        assertThat(em.find(Edition.class, edition.getId()).getCompetition().getId()).isEqualTo(old.getId());
    }

    @Test
    @DisplayName("La primera vez, con la fila sin anotar y partidos de esa temporada, solo se anota")
    void theFirstTimeOnlyAnnotates() {
        Competition row = competition("test.primera", null);
        played(row, START.plus(Duration.ofDays(2)));
        match(row, START.plus(Duration.ofDays(60)), false, MatchStatusNormalized.SCHEDULED);

        assertStays(row, NEXT);

        assertThat(seasonOf(row)).isEqualTo(NEXT.label());
    }

    @Test
    @DisplayName("Una fila sin anotar que guarda entera la temporada anterior se archiva con la etiqueta de sus partidos")
    void anUnlabelledRowOfThePreviousSeasonRollsOver() {
        Competition old = competition("test.sin-anotar", null);
        Instant first = START.minus(Duration.ofDays(200));
        Instant last = START.minus(Duration.ofDays(40));
        played(old, first);
        played(old, last);

        Competition next = seasons.enterSeason(old.getId(), NEXT);

        assertThat(next.getId()).isNotEqualTo(old.getId());
        assertThat(next.getSeason()).isEqualTo(NEXT.label());
        Competition archived = reload(old);
        assertThat(archived.isArchived()).isTrue();
        assertThat(archived.getSeason()).isEqualTo(CompetitionSeasonService.labelOf(first, last.plus(Duration.ofDays(1))));
    }

    @Test
    @DisplayName("Con un partido de la temporada anterior aún por jugar, no cambia")
    void aPendingMatchBlocksTheChange() {
        Competition scheduled = played("test.pendiente");
        match(scheduled, START.minus(Duration.ofDays(3)), false, MatchStatusNormalized.SCHEDULED);
        Competition live = played("test.en-juego");
        match(live, START.minus(Duration.ofHours(1)), false, MatchStatusNormalized.LIVE);
        Competition unknown = played("test.sin-estado");
        match(unknown, START.minus(Duration.ofDays(3)), false, null);

        for (Competition row : List.of(scheduled, live, unknown)) assertStays(row, NEXT);
    }

    @Test
    @DisplayName("Un partido aplazado, cancelado o abandonado que ya no se va a jugar no frena el cambio")
    void postponedAndCancelledMatchesDoNotBlock() {
        Competition old = played("test.aplazado");
        match(old, START.minus(Duration.ofDays(50)), false, MatchStatusNormalized.POSTPONED);
        match(old, START.minus(Duration.ofDays(60)), false, MatchStatusNormalized.CANCELLED);
        match(old, START.minus(Duration.ofDays(70)), false, MatchStatusNormalized.ABANDONED);

        Competition next = seasons.enterSeason(old.getId(), NEXT);

        assertThat(next.getId()).isNotEqualTo(old.getId());
        assertThat(reload(old).isArchived()).isTrue();
    }

    @Test
    @DisplayName("Sin partidos de la temporada anterior no hay nada que archivar")
    void aRowWithoutOldMatchesStays() {
        Competition empty = em.persistFlushFind(Competition.builder().name("Liga de prueba").externalId("test.sin-partidos")
                .season(PREVIOUS).build());
        Competition onlyNew = em.persistFlushFind(Competition.builder().name("Liga de prueba").externalId("test.solo-nuevos")
                .season(PREVIOUS).build());
        match(onlyNew, START.plus(Duration.ofDays(5)), false, MatchStatusNormalized.SCHEDULED);

        assertStays(empty, NEXT);
        assertStays(onlyNew, NEXT);

        assertThat(seasonOf(empty)).isEqualTo(PREVIOUS);
    }

    @Test
    @DisplayName("La misma temporada, una más vieja o una etiqueta que no se entiende no cambian nada")
    void onlyANewerSeasonChangesIt() {
        Competition same = played("test.misma");
        same.setSeason(NEXT.label());
        Competition newer = played("test.mas-nueva");
        newer.setSeason(String.valueOf(NEXT.startYear() + 1));
        Competition odd = played("test.rara");
        odd.setSeason("Clausura");
        em.flush();

        for (Competition row : List.of(same, newer, odd)) assertStays(row, NEXT);

        assertThat(seasonOf(newer)).isEqualTo(String.valueOf(NEXT.startYear() + 1));
        assertThat(seasonOf(odd)).isEqualTo("Clausura");
    }

    @Test
    @DisplayName("Una temporada del proveedor ya terminada o que empieza muy lejos no archiva nada")
    void aSeasonThatIsNotCurrentChangesNothing() {
        Instant now = Instant.now();
        Season over = new Season(NEXT.label(), now.minus(Duration.ofDays(300)), now.minus(Duration.ofDays(1)));
        Season far = new Season(NEXT.label(), now.plus(Duration.ofDays(400)), now.plus(Duration.ofDays(700)));
        Competition ended = em.persistFlushFind(Competition.builder().name("Liga de prueba").externalId("test.acabada")
                .season(PREVIOUS).build());
        played(ended, now.minus(Duration.ofDays(500)));
        Competition early = played("test.lejana");

        assertStays(ended, over);
        assertStays(early, far);
    }

    @Test
    @DisplayName("Un torneo con grupos no cambia solo de temporada: la suya la fija su formato")
    void aGroupTournamentNeverRollsOver() {
        Competition worldCup = competitions.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID).orElseThrow();
        worldCup.setSeason(PREVIOUS);
        em.flush();
        played(worldCup, START.minus(Duration.ofDays(120)));
        assertThat(matches.countPendingBefore(worldCup.getId(), START)).isZero();

        assertStays(worldCup, NEXT);
    }

    @Test
    @DisplayName("Con el interruptor apagado se sigue anotando, pero nada se archiva")
    void theKillSwitchStopsEveryChange() {
        ReflectionTestUtils.setField(seasons, "rolloverEnabled", false);
        Competition old = played("test.apagado");
        Competition fresh = competition("test.apagado-nueva", null);

        assertStays(old, NEXT);
        assertStays(fresh, NEXT);

        assertThat(seasonOf(fresh)).isEqualTo(NEXT.label());
    }

    @Test
    @DisplayName("Sin temporada del proveedor, en una fila archivada o en una competición personalizada no hace nada")
    void aStrangeProviderAnswerChangesNothing() {
        Competition old = played("test.sin-temporada");
        Competition archived = competition("test.ya-archivada", Instant.parse("2026-07-01T00:00:00Z"));
        played(archived, START.minus(Duration.ofDays(200)));

        assertStays(old, null);
        assertStays(old, Season.of(new SeasonWindow("no es fecha", "2027-01-01T00:00Z")));
        assertThat(seasons.enterSeason(archived.getId(), NEXT).getId()).isEqualTo(archived.getId());
        assertThat(seasons.enterSeason(-1L, NEXT)).isNull();
        assertThat(competitions.findByExternalId("test.ya-archivada")).isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @DisplayName("Al confirmarse el cambio se vacían el catálogo y las tablas en caché")
    void evictsTheCachesOnceCommitted() {
        Competition old = competitions.save(Competition.builder().name("Liga con caché").externalId("test.cache")
                .season(PREVIOUS).build());
        Match match = matches.save(Match.builder().competition(old).matchDate(START.minus(Duration.ofDays(40)))
                .finished(true).status(MatchStatusNormalized.FINISHED).build());
        Long nextId = null;
        try {
            for (String name : CompetitionSeasonService.CACHES) caches.getCache(name).put("clave", "valor");

            nextId = seasons.enterSeason(old.getId(), NEXT).getId();

            assertThat(nextId).isNotEqualTo(old.getId());
            for (String name : CompetitionSeasonService.CACHES) {
                assertThat(caches.getCache(name).get("clave")).as(name).isNull();
            }
        } finally {
            matches.deleteById(match.getId());
            if (nextId != null) competitions.deleteById(nextId);
            competitions.deleteById(old.getId());
        }
    }

    @Test
    @DisplayName("Por id externo y por nombre solo se encuentra la temporada vigente, no las archivadas")
    void lookupsOnlyFindTheCurrentSeason() {
        Competition old = competition("test.temporadas", Instant.parse("2026-07-01T00:00:00Z"));
        Competition older = competition("test.temporadas", Instant.parse("2025-07-01T00:00:00Z"));
        Competition current = competition("test.temporadas", null);
        Competition onlyArchived = competition("test.solo-archivada", Instant.parse("2026-07-01T00:00:00Z"));

        assertThat(competitions.findByExternalId("test.temporadas")).map(Competition::getId).contains(current.getId());
        assertThat(competitions.findIdByExternalId("test.temporadas")).contains(current.getId());
        assertThat(competitions.findByExternalIdIn(List.of("test.temporadas", "test.solo-archivada")))
                .extracting(Competition::getId).containsExactly(current.getId());
        assertThat(competitions.findByName("Liga de prueba")).map(Competition::getId).contains(current.getId());
        assertThat(competitions.findByExternalId("test.solo-archivada")).isEmpty();
        assertThat(competitions.findIdByExternalId("test.solo-archivada")).isEmpty();
        // A las archivadas se sigue llegando por su id: sus ligas las conservan.
        assertThat(competitions.findAllById(List.of(old.getId(), older.getId(), onlyArchived.getId()))).hasSize(3);
        assertThat(old.isArchived()).isTrue();
        assertThat(current.isArchived()).isFalse();
    }

    @Test
    @DisplayName("No caben dos temporadas vigentes de la misma competición")
    void twoCurrentSeasonsOfACompetitionAreRejected() {
        competition("test.unica", null);

        assertThatThrownBy(() -> competition("test.unica", null))
                .hasMessageContaining("uq_competitions_current_external_id");
    }
}
