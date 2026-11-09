package app.porrapp.service.league;

import app.porrapp.service.sync.CompetitionImportRequestedEvent;
import app.porrapp.exception.BusinessException;
import app.porrapp.dto.LeagueMemberDTO;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.UserAccount;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LeagueServiceTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private CompetitionRepository competitionRepository;

    @Mock
    private EditionRepository editionRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private LeaguePaymentService paymentService;

    @Mock
    private LeagueSeasons leagueSeasons;

    @InjectMocks
    private LeagueService leagueService;

    private UserAccount admin;
    private UserAccount member;
    private UserAccount stranger;
    private League league;

    @BeforeEach
    void setUp() {
        admin = UserAccount.builder()
                .id(1L)
                .googleEmail("admin@test.com")
                .participantName("Admin Liga")
                .build();

        member = UserAccount.builder()
                .id(2L)
                .googleEmail("member@test.com")
                .participantName("Miembro Regular")
                .build();

        stranger = UserAccount.builder()
                .id(3L)
                .googleEmail("stranger@test.com")
                .participantName("Desconocido")
                .build();

        league = League.builder()
                .id(10L)
                .name("Liga Privada")
                .joinCode("AMIGOS")
                .adminUser(admin)
                .build();
        lenient().when(leagueSeasons.status(any(), any(), any())).thenReturn(LeagueSeasons.Status.NONE);
    }

    @Test
    @DisplayName("Mis ligas incluyen cuándo se unió el usuario a cada una")
    void myLeaguesIncludeWhenTheUserJoined() {
        java.time.Instant joined = java.time.Instant.parse("2026-11-01T10:00:00Z");
        Membership membership = new Membership();
        membership.setId(new Membership.MembershipId(2L, 10L));
        membership.setJoinedAt(joined);
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.findByUserId(2L)).thenReturn(List.of(membership));
        when(leagueRepository.findAllById(java.util.Set.of(10L))).thenReturn(List.of(league));
        when(editionRepository.findByLeagueIdInAndStatus(List.of(10L), "ACTIVE")).thenReturn(List.of());

        var mine = leagueService.getUserLeagueDTOs("member@test.com");

        assertEquals(1, mine.size());
        assertEquals(10L, mine.get(0).getId());
        assertEquals(joined, mine.get(0).getJoinedAt());
    }

    @Test
    @DisplayName("createLeague con una clave ya usada devuelve la liga existente sin crear otra")
    void createGroupWithRepeatedKeyReturnsExistingLeague() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.findByAdminUserIdAndCreationKey(admin.getId(), "clave-1234"))
                .thenReturn(Optional.of(league));

        League result = leagueService.createLeague(NewLeague.of("Liga Privada", "admin@test.com", 8L,
                app.porrapp.model.PoolFormat.MATCH_DAY).withPichichi(false).withCreationKey("clave-1234"));

        assertSame(league, result);
        verify(leagueRepository, never()).save(any());
        verify(editionRepository, never()).save(any());
    }

    @Test
    void createCustomCompetitionBelongsToNewLeague() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.save(any(League.class))).thenReturn(league);
        when(competitionRepository.save(any(Competition.class))).thenAnswer(invocation -> invocation.getArgument(0));

        leagueService.createLeague(NewLeague.custom("Liga Privada", "admin@test.com", "Torneo local",
                app.porrapp.model.PoolFormat.MATCH_DAY).withPichichi(false)
                .withCustomSport(app.porrapp.model.Sport.BASKETBALL));

        var competition = org.mockito.ArgumentCaptor.forClass(Competition.class);
        verify(competitionRepository).save(competition.capture());
        assertEquals(league, competition.getValue().getOwnerLeague());
        assertEquals("Torneo local", competition.getValue().getName());
        assertEquals(app.porrapp.model.Sport.BASKETBALL, competition.getValue().sport());
        verify(editionRepository).save(argThat(edition -> !edition.isPichichi()
                && edition.getCompetition() == competition.getValue()));
    }

    @Test
    void createCustomBracketCompetitionUsesTournamentFormat() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.save(any(League.class))).thenReturn(league);
        when(competitionRepository.save(any(Competition.class))).thenAnswer(invocation -> invocation.getArgument(0));

        leagueService.createLeague(NewLeague.custom("Liga Privada", "admin@test.com", "Copa local",
                app.porrapp.model.PoolFormat.FULL_BRACKET).withPichichi(false));

        verify(competitionRepository).save(argThat(competition -> "TOURNAMENT".equals(competition.getFormatType())
                && competition.getOwnerLeague() == league));
        verify(editionRepository).save(argThat(edition -> edition.getPoolFormat()
                == app.porrapp.model.PoolFormat.FULL_BRACKET));
    }

    @Test
    @DisplayName("createLeague no admite una temporada ya archivada")
    void createLeague_RejectsAnArchivedSeason() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(competitionRepository.findById(8L)).thenReturn(Optional.of(Competition.builder().id(8L)
                .externalId("esp.1").season("2025/26").archivedAt(java.time.Instant.now()).build()));

        BusinessException error = assertThrows(BusinessException.class, () -> leagueService.createLeague(
                NewLeague.of("Otra liga", "admin@test.com", 8L, app.porrapp.model.PoolFormat.MATCH_DAY).withPichichi(false)));

        assertTrue(error.getMessage().contains("temporada"));
        verify(leagueRepository, never()).save(any());
    }

    @Test
    void existingCustomCompetitionCannotBeReusedByAnotherLeague() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(competitionRepository.findById(8L)).thenReturn(Optional.of(Competition.builder()
                .ownerLeague(league).build()));

        assertThrows(BusinessException.class, () -> leagueService.createLeague(NewLeague.of("Otra liga", "admin@test.com", 8L,
                app.porrapp.model.PoolFormat.MATCH_DAY).withPichichi(false)));
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("createLeague no adivina la competición de una sin proveedor por su nombre")
    void createGroup_RejectsCompetitionWithoutProvider() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        // Una competición antigua sin id externo: antes «Mundial» en el nombre la convertía en el Mundial.
        when(competitionRepository.findById(1L)).thenReturn(Optional.of(Competition.builder()
                .id(1L).name("Mundial de clubes").build()));

        BusinessException error = assertThrows(BusinessException.class, () -> leagueService.createLeague(
                NewLeague.of("Prueba", "admin@test.com", 1L, app.porrapp.model.PoolFormat.FULL_BRACKET)));

        assertEquals(400, error.getStatus().value());
        verify(competitionRepository, never()).findByExternalId(anyString());
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("createLeague exige el formato: no hay cuadro por defecto")
    void createGroup_RequiresPoolFormat() {
        assertThrows(BusinessException.class, () -> leagueService.createLeague(
                NewLeague.of("Sin formato", "admin@test.com", 2L, null)));
        verify(leagueRepository, never()).save(any());
        verify(editionRepository, never()).save(any());
    }

    @Test
    @DisplayName("El pichichi se guarda en el cuadro del Mundial y, si se pide, en cualquier liga de fútbol por jornadas")
    void createGroup_KeepsPichichiWhereItCanBePlayed() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.save(any(League.class))).thenReturn(league);
        when(competitionRepository.findById(5L)).thenReturn(Optional.of(Competition.builder().id(5L)
                .externalId("uefa.champions").formatType("LEAGUE").build()));
        when(competitionRepository.findById(2L)).thenReturn(Optional.of(Competition.builder().id(2L)
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).formatType("TOURNAMENT").build()));

        leagueService.createLeague(NewLeague.of("Champions", "admin@test.com", 5L,
                app.porrapp.model.PoolFormat.MATCH_DAY).withPichichi(true));
        leagueService.createLeague(NewLeague.of("Mundial por jornadas", "admin@test.com", 2L,
                app.porrapp.model.PoolFormat.MATCH_DAY).withPichichi(true));
        leagueService.createLeague(NewLeague.of("Mundial", "admin@test.com", 2L,
                app.porrapp.model.PoolFormat.FULL_BRACKET).withPichichi(true));
        // Sin pedirlo, solo el cuadro del torneo con grupos: como antes de abrirlo a las demás.
        leagueService.createLeague(NewLeague.of("Champions sin pedirlo", "admin@test.com", 5L,
                app.porrapp.model.PoolFormat.MATCH_DAY));
        leagueService.createLeague(NewLeague.of("Mundial sin pedirlo", "admin@test.com", 2L,
                app.porrapp.model.PoolFormat.FULL_BRACKET));
        // En superviviente no se juega a puntos, ni se le pregunta a quien no lo quiere.
        leagueService.createLeague(NewLeague.of("Superviviente", "admin@test.com", 5L,
                app.porrapp.model.PoolFormat.SURVIVOR).withPichichi(true));
        leagueService.createLeague(NewLeague.of("Mundial sin pichichi", "admin@test.com", 2L,
                app.porrapp.model.PoolFormat.FULL_BRACKET).withPichichi(false));

        org.mockito.ArgumentCaptor<app.porrapp.model.Edition> saved =
                org.mockito.ArgumentCaptor.forClass(app.porrapp.model.Edition.class);
        verify(editionRepository, org.mockito.Mockito.times(7)).save(saved.capture());
        assertEquals(java.util.List.of(true, true, true, false, true, false, false),
                saved.getAllValues().stream().map(app.porrapp.model.Edition::isPichichi).toList());
    }

    @Test
    void createWorldCupBracketHasTheTournamentDeadline() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition worldCup = Competition.builder().id(2L)
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        when(competitionRepository.findById(2L)).thenReturn(Optional.of(worldCup));
        when(leagueRepository.save(any(League.class))).thenReturn(league);

        leagueService.createLeague(NewLeague.of("Mundial", "admin@test.com", 2L,
                app.porrapp.model.PoolFormat.FULL_BRACKET));

        verify(editionRepository).save(argThat(edition ->
                java.time.Instant.parse("2026-06-11T18:00:00Z").equals(edition.getLockDate())));
    }

    @Test
    void aRegularLeagueHasNoBracketToFillIn() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition laLiga = Competition.builder().id(3L).externalId("esp.1").formatType("LEAGUE").build();
        when(competitionRepository.findById(3L)).thenReturn(Optional.of(laLiga));

        for (var format : java.util.List.of(app.porrapp.model.PoolFormat.FULL_BRACKET,
                app.porrapp.model.PoolFormat.KNOCKOUTS_ONLY)) {
            BusinessException error = assertThrows(BusinessException.class, () -> leagueService.createLeague(
                    NewLeague.of("LaLiga", "admin@test.com", 3L, format)));
            assertEquals("Esta competición se juega por jornadas: no tiene cuadro que rellenar", error.getMessage());
        }
        verify(leagueRepository, org.mockito.Mockito.never()).save(any(League.class));
    }

    @Test
    @DisplayName("updateLeague rechaza si el nombre está vacío")
    void updateGroup_ThrowsIfEmpty() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.updateLeague(10L, "   ", null, null, "admin@test.com"));
    }

    @Test
    @DisplayName("updateLeague activa la cuota de una liga privada")
    void updateGroup_EnablesEntryFee() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueRepository.save(league)).thenReturn(league);

        leagueService.updateLeague(10L, null, null, true, "admin@test.com");

        assertTrue(league.isEntryFee());
    }

    @Test
    @DisplayName("updateLeague no deja poner cuota a una liga pública")
    void updateGroup_RejectsEntryFeeOnPublicLeague() {
        league.setPublicLeague(true);
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.updateLeague(10L, null, null, true, "admin@test.com"));
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateLeague rechaza si el solicitante no es el admin de la liga")
    void updateGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.updateLeague(10L, "Nuevo Nombre", null, null, "member@test.com"));

        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteLeague rechaza si un usuario cualquiera intenta borrar la liga")
    void deleteGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.deleteLeague(10L, "stranger@test.com"));

        verify(leagueRepository, never()).deleteById(any());
    }

    @Test
    void assertCanView_PublicLeagueIsOpen() {
        when(leagueRepository.findById(50L)).thenReturn(Optional.of(
                League.builder().id(50L).name("Abierta").joinCode("ABIERTA").publicLeague(true).build()));
        assertDoesNotThrow(() -> leagueService.assertCanView(50L, null));
    }

    @Test
    void assertCanView_RejectsNonMembersOfPrivateLeague() {
        UserAccount stranger = UserAccount.builder().id(7L).googleEmail("stranger@test.com").build();
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        BusinessException e = assertThrows(BusinessException.class, () -> leagueService.assertCanView(10L, "stranger@test.com"));
        assertEquals("No perteneces a esta liga privada", e.getMessage());
        assertThrows(BusinessException.class, () -> leagueService.assertCanView(10L, null));
    }

    @Test
    void assertCanView_AllowsMembers() {
        UserAccount member = UserAccount.builder().id(8L).googleEmail("member@test.com").build();
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.existsById(new Membership.MembershipId(8L, 10L))).thenReturn(true);

        assertDoesNotThrow(() -> leagueService.assertCanView(10L, "member@test.com"));
    }

    @Test
    @DisplayName("Regenerar el código da uno nuevo de 10 caracteres base32 y lo guarda")
    void regenerateJoinCodeUsesLongSecureCodes() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());

        String code = leagueService.regenerateJoinCode(10L, "admin@test.com");

        assertTrue(code.matches("[A-HJ-NP-Z2-9]{10}"), code);
        assertEquals(code, league.getJoinCode());
        verify(leagueRepository).save(league);
    }

    @Test
    @DisplayName("Una liga privada no existe para quien no es miembro, ni con sesión ni sin ella")
    void nonMemberCannotSeePrivateLeague() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(new Membership.MembershipId(3L, 10L))).thenReturn(false);

        assertTrue(leagueService.findLeagueResponse(10L, "stranger@test.com").isEmpty());
        assertTrue(leagueService.findLeagueResponse(10L, null).isEmpty());
    }

    @Test
    @DisplayName("Un miembro ve la liga completa con su código")
    void memberGetsFullLeague() {
        league.setRules("Reglas internas");
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.existsById(new Membership.MembershipId(2L, 10L))).thenReturn(true);

        var dto = leagueService.findLeagueResponse(10L, "member@test.com").orElseThrow();

        assertEquals("AMIGOS", dto.getJoinCode());
        assertEquals("Reglas internas", dto.getRules());
        assertEquals(1L, dto.getAdminUserId());
    }

    @Test
    @DisplayName("Una liga de varias competiciones lista cada una, la principal primero, para ver su tabla")
    void multiCompetitionLeagueListsItsCompetitions() {
        Competition laliga = Competition.builder().id(2L).name("LaLiga").externalId("esp.1").build();
        Competition premier = Competition.builder().id(4L).name("Premier League").externalId("eng.1").build();
        Competition champions = Competition.builder().id(3L).name("Champions League").externalId("uefa.champions").build();
        Edition edition = Edition.builder().id(7L).competition(laliga).multiCompetition(true).build();
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(competitionRepository.findByEditionId(7L)).thenReturn(List.of(premier, laliga, champions));

        var dto = leagueService.toResponse(league, true);

        assertEquals(List.of("esp.1", "uefa.champions", "eng.1"),
                dto.getCompetitions().stream().map(c -> c.externalId()).toList());
        assertEquals("Champions League", dto.getCompetitions().get(1).name());
    }

    @Test
    @DisplayName("Una liga de una sola competición no lista competiciones")
    void singleCompetitionLeagueListsNone() {
        Competition laliga = Competition.builder().id(2L).name("LaLiga").externalId("esp.1").build();
        Edition edition = Edition.builder().id(7L).competition(laliga).build();
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));

        assertNull(leagueService.toResponse(league, true).getCompetitions());
        verify(competitionRepository, never()).findByEditionId(any());
    }

    @Test
    void championsKnockoutsCloseRoundByRoundAndRejectTheFullBracket() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition champions = Competition.builder().id(5L).externalId("uefa.champions").formatType("LEAGUE").build();
        when(competitionRepository.findById(5L)).thenReturn(Optional.of(champions));
        lenient().when(leagueRepository.save(any(League.class))).thenReturn(league);

        assertThrows(BusinessException.class, () -> leagueService.createLeague(NewLeague.of("Champions", "admin@test.com", 5L,
                app.porrapp.model.PoolFormat.FULL_BRACKET)));

        leagueService.createLeague(NewLeague.of("Champions", "admin@test.com", 5L,
                app.porrapp.model.PoolFormat.KNOCKOUTS_ONLY));
        verify(editionRepository).save(argThat(edition ->
                edition.getLockMode() == app.porrapp.model.PredictionLockMode.PER_ROUND));
    }

    @Test
    void tennisIsPlayedMatchByMatchWithTennisScoring() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition rolandGarros = Competition.builder().id(6L).externalId("tennis.atp.172").formatType("TOURNAMENT").build();
        when(competitionRepository.findById(6L)).thenReturn(Optional.of(rolandGarros));
        lenient().when(leagueRepository.save(any(League.class))).thenReturn(league);

        assertThrows(BusinessException.class, () -> leagueService.createLeague(NewLeague.of("RG", "admin@test.com", 6L,
                app.porrapp.model.PoolFormat.KNOCKOUTS_ONLY)));

        leagueService.createLeague(NewLeague.of("RG", "admin@test.com", 6L, app.porrapp.model.PoolFormat.MATCH_DAY));
        verify(editionRepository).save(argThat(edition -> app.porrapp.scoring.ScoringRuleSet.defaultTennis().toJson()
                .equals(edition.getScoringRulesJson())));
    }

    @Test
    void aBracketLeagueCannotBeCreatedOnceTheKnockoutsHaveStarted() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition worlds = Competition.builder().id(19L).externalId("lol.worlds").formatType("TOURNAMENT").build();
        when(competitionRepository.findById(19L)).thenReturn(Optional.of(worlds));
        lenient().when(leagueRepository.save(any(League.class))).thenReturn(league);
        app.porrapp.model.Match quarter = app.porrapp.model.Match.builder().id(1L).competition(worlds)
                .round("qf").homeTeam(app.porrapp.model.Team.builder().id(1L).name("T1").build())
                .awayTeam(app.porrapp.model.Team.builder().id(2L).name("GEN").build())
                .matchDate(java.time.Instant.now().minusSeconds(3600)).build();
        when(matchRepository.findByCompetitionId(19L)).thenReturn(List.of(quarter));

        BusinessException error = assertThrows(BusinessException.class, () -> leagueService.createLeague(
                NewLeague.of("Worlds", "admin@test.com", 19L, app.porrapp.model.PoolFormat.KNOCKOUTS_ONLY)));
        assertTrue(error.getMessage().contains("ya han empezado"));

        leagueService.createLeague(NewLeague.of("Worlds", "admin@test.com", 19L, app.porrapp.model.PoolFormat.MATCH_DAY));
        verify(editionRepository).save(any());
    }
}
