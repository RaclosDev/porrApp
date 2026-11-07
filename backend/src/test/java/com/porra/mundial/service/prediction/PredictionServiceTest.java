package com.porra.mundial.service.prediction;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PredictionServiceTest {

    @Mock
    private PredictionRepository predictionRepository;@Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private EditionRepository editionRepository;@Mock
    private MembershipRepository membershipRepository;

    @org.mockito.Spy
    private BracketPredictionValidator bracketValidator = new BracketPredictionValidator(mock(com.porra.mundial.repository.TeamRepository.class));

    @Mock
    private CustomBracketPredictionValidator customBracketValidator;

    @Mock
    private CustomLockService customLockService;

    @InjectMocks
    private PredictionService predictionService;

    private UserAccount owner;
    private UserAccount groupAdmin;
    private UserAccount stranger;
    private League group;
    private Edition edition;
    private Prediction prediction;

    private Edition customEdition(com.porra.mundial.model.PredictionLockMode mode) {
        com.porra.mundial.model.Competition competition = com.porra.mundial.model.Competition.builder()
                .name("Copa").ownerLeague(group).build();
        competition.setId(9L);
        return Edition.builder().league(group).competition(competition)
                .poolFormat(com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY).lockMode(mode).build();
    }

    private static CustomLockService.LockState lockState(boolean anyLocked) {
        return new CustomLockService.LockState(com.porra.mundial.model.PredictionLockMode.PER_MATCH, 0, null,
                List.of(), List.of(List.of(anyLocked, false)), anyLocked, false, null);
    }

    @Test
    void progressiveLockRejectsNewPredictionsOnceSomethingHasStarted() {
        Edition custom = customEdition(com.porra.mundial.model.PredictionLockMode.PER_MATCH);
        when(userAccountRepository.findByGoogleEmail("owner@test.com")).thenReturn(Optional.of(owner));
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(custom));
        when(membershipRepository.existsById(any())).thenReturn(true);
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("owner@test.com", 100L)).thenReturn(Optional.empty());
        when(customLockService.state(custom)).thenReturn(lockState(true));

        BusinessException error = assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("owner@test.com", "Tarde", new PredictionDataDTO(), 100L));
        assertTrue(error.getMessage().contains("ya ha empezado"));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    void othersOnlySeeTheLockedPartsWhileTheRestIsOpen() {
        Edition custom = customEdition(com.porra.mundial.model.PredictionLockMode.PER_MATCH);
        prediction.setEdition(custom);
        PredictionDataDTO hidden = new PredictionDataDTO();
        CustomLockService.LockState state = lockState(true);
        when(customLockService.state(custom)).thenReturn(state);
        when(customLockService.lockedPartsOnly(eq(state), any())).thenReturn(hidden);

        List<PredictionResponseDTO> list = predictionService.toPredictionDtoList(List.of(prediction), "stranger@test.com");

        assertSame(hidden, list.get(0).getData());
    }

    @Test
    void refusesMissingRequestedEditionInsteadOfSavingInAnotherLeague() {
        group.setId(50L);
        when(userAccountRepository.findByGoogleEmail("owner@test.com")).thenReturn(Optional.of(owner));
        when(editionRepository.findByLeagueIdAndStatus(999L, "ACTIVE")).thenReturn(Optional.empty());
        lenient().when(editionRepository.findByLeagueIdAndStatus(50L, "ACTIVE")).thenReturn(Optional.of(edition));
        assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("owner@test.com", "Mi liga", new PredictionDataDTO(), 999L));
        verify(editionRepository, never()).findByLeagueIdAndStatus(50L, "ACTIVE");
        verify(predictionRepository, never()).save(any());
    }

    @Test
    void refusesToSaveWithoutAnExistingUserAccount() {
        when(userAccountRepository.findByGoogleEmail("missing@test.com")).thenReturn(Optional.empty());
        lenient().when(editionRepository.findByLeagueIdAndStatus(50L, "ACTIVE")).thenReturn(Optional.of(edition));
        assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("missing@test.com", "Sin cuenta", new PredictionDataDTO(), null));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    void refusesToCreateAPredictionWithoutALeague() {
        assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("owner@test.com", "Sin liga", new PredictionDataDTO(), null));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    void rejectsChangingHistoricalTopologyThroughUpsert() {
        prediction.setBracketData(new PredictionDataDTO());
        var canonical = new PredictionDataDTO();
        canonical.setTopologyVersion(2);
        when(userAccountRepository.findByGoogleEmail("owner@test.com")).thenReturn(Optional.of(owner));
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(membershipRepository.existsById(any())).thenReturn(true);
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("owner@test.com", 100L)).thenReturn(Optional.of(prediction));
        assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("owner@test.com", "Nueva", canonical, 100L));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    void canonicalPartialPredictionsAreNotFilledWithGuessedFinalistsOnRead() {
        var data = new PredictionDataDTO();
        data.setTopologyVersion(2);
        data.setSf(List.of(List.of("A", "B"), List.of("C", "D")));
        data.setChampion("A");
        predictionService.ensureKnockoutFinals(data);
        assertNull(data.getFinalMatch());
        assertNull(data.getThirdPlaceMatch());
    }

    @BeforeEach
    void setUp() {
        owner = UserAccount.builder()
                .id(10L)
                .googleEmail("owner@test.com")
                .participantName("OwnerUser")
                .build();

        groupAdmin = UserAccount.builder()
                .id(20L)
                .googleEmail("admin@test.com")
                .participantName("GroupAdminUser")
                .build();

        stranger = UserAccount.builder()
                .id(30L)
                .googleEmail("stranger@test.com")
                .participantName("StrangerUser")
                .build();

        group = League.builder()
                .id(100L)
                .name("Liga Amigos")
                .joinCode("AMIGOS")
                .adminUser(groupAdmin)
                .build();

        edition = Edition.builder()
                .id(1L)
                .league(group)
                .poolFormat(com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY)
                .competition(com.porra.mundial.model.Competition.builder().externalId("fifa.world").build())
                .status("ACTIVE")
                .build();

        prediction = Prediction.builder()
                .id(1L)
                .user(owner)
                .edition(edition)
                .name("Porra Ganadora")
                .bracketData(new PredictionDataDTO())
                .paymentStatus("PENDING")
                .build();
    }

    @Test
    void rejectsBracketInMatchDayEdition() {
        edition.setPoolFormat(com.porra.mundial.model.PoolFormat.MATCH_DAY);
        when(userAccountRepository.findByGoogleEmail("owner@test.com")).thenReturn(Optional.of(owner));
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(membershipRepository.existsById(any())).thenReturn(true);
        assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("owner@test.com", null, new PredictionDataDTO(), 100L));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("createPrediction rechaza si el usuario no es miembro de la liga privada")
    void cannotCreatePredictionIfNotMemberOfPrivateLeague() {
        edition.setStatus("ACTIVE");
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("stranger@test.com", "Mi Porra", new PredictionDataDTO(), 100L)
        );

        assertTrue(ex.getMessage().contains("No perteneces a esta liga privada"));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("cannotCreatePredictionWhenEditionIsLocked")
    void cannotCreatePredictionWhenEditionIsLocked() {
        edition.setStatus("LOCKED");
        when(userAccountRepository.findByGoogleEmail("owner@test.com")).thenReturn(Optional.of(owner));
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(edition));

        assertThrows(BusinessException.class, () ->
                predictionService.createPrediction("owner@test.com", "Mi Porra", new PredictionDataDTO(), 100L)
        );

        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Usuarios desconocidos no ven los pronosticos detallados de otros antes del cierre")
    void otherUsersCannotSeePredictionsBeforeLock() {
        edition.setStatus("ACTIVE");

        List<PredictionResponseDTO> result = predictionService.toPredictionDtoList(List.of(prediction), "stranger@test.com");

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("OwnerUser", result.get(0).getParticipantName());
        assertNull(result.get(0).getData(), "Los datos de la porra ajena deben estar ocultos antes del cierre");
    }

    @Test
    @DisplayName("El dueno de la porra si puede ver sus propios pronosticos antes del cierre")
    void ownerCanSeePredictionsBeforeLock() {
        edition.setStatus("ACTIVE");
        List<PredictionResponseDTO> result = predictionService.toPredictionDtoList(List.of(prediction), "owner@test.com");

        assertNotNull(result);
        assertEquals(1, result.size());
        assertNotNull(result.get(0).getData(), "El dueno debe poder ver sus propios datos");
    }

    @Test
    @DisplayName("Todos los usuarios pueden ver todas las porras una vez alcanzado el cierre")
    void allUsersCanSeePredictionsAfterLock() {
        edition.setStatus("LOCKED");
        List<PredictionResponseDTO> result = predictionService.toPredictionDtoList(List.of(prediction), "stranger@test.com");

        assertNotNull(result);
        assertEquals(1, result.size());
        assertNotNull(result.get(0).getData(), "Tras el cierre, los datos deben ser publicos para todos");
    }

    @Test
    @DisplayName("Consultar el detalle individual de una porra ajena antes del cierre lanza SecurityException")
    void strangerCannotGetSinglePredictionBeforeLock() {
        edition.setStatus("ACTIVE");
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertThrows(BusinessException.class, () ->
                predictionService.getPredictionData(1L, "stranger@test.com")
        );
    }

    @Test
    @DisplayName("Quien no es miembro no ve un pronóstico de una liga privada ni tras el cierre")
    void nonMemberCannotGetPrivateLeaguePredictionAfterLock() {
        edition.setStatus("LOCKED");
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(new Membership.MembershipId(30L, 100L))).thenReturn(false);

        assertThrows(BusinessException.class, () -> predictionService.getPredictionData(1L, "stranger@test.com"));
        assertThrows(BusinessException.class, () -> predictionService.getPredictionData(1L, null));
    }

    @Test
    @DisplayName("Un miembro ve los pronósticos de su liga tras el cierre")
    void memberCanGetPrivateLeaguePredictionAfterLock() {
        edition.setStatus("LOCKED");
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(groupAdmin));
        when(membershipRepository.existsById(new Membership.MembershipId(20L, 100L))).thenReturn(true);

        assertNotNull(predictionService.getPredictionData(1L, "admin@test.com"));
    }

    @Test
    @DisplayName("Los pronósticos de una liga pública los ve cualquiera tras el cierre")
    void publicLeaguePredictionIsPublicAfterLock() {
        League global = League.builder().id(50L).joinCode("ABIERTA").publicLeague(true).build();
        edition.setLeague(global);
        edition.setStatus("LOCKED");
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertNotNull(predictionService.getPredictionData(1L, null));
    }

    @Test
    void drawnKnockoutsAcceptLateEntriesForTheRoundsStillOpen() {
        com.porra.mundial.model.Competition champions = com.porra.mundial.model.Competition.builder().id(5L)
                .externalId("uefa.champions").formatType("LEAGUE").build();
        Edition knockouts = Edition.builder().league(group).competition(champions)
                .poolFormat(com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY)
                .lockMode(com.porra.mundial.model.PredictionLockMode.PER_ROUND).build();
        when(userAccountRepository.findByGoogleEmail("owner@test.com")).thenReturn(Optional.of(owner));
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(knockouts));
        when(membershipRepository.existsById(any())).thenReturn(true);
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("owner@test.com", 100L)).thenReturn(Optional.empty());
        when(customLockService.state(knockouts)).thenReturn(lockState(true));

        predictionService.createPrediction("owner@test.com", "Tarde", new PredictionDataDTO(), 100L);

        verify(customBracketValidator).validate(eq(knockouts), any());
        verify(predictionRepository).save(any());
    }
}
