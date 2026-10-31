package com.porra.mundial.service;

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
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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

    @InjectMocks
    private PredictionService predictionService;

    private UserAccount owner;
    private UserAccount groupAdmin;
    private UserAccount stranger;
    private League group;
    private Edition edition;
    private Prediction prediction;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(predictionService, "paymentService", new LeaguePaymentService(membershipRepository, predictionRepository));

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
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));
        assertThrows(IllegalArgumentException.class, () ->
                predictionService.updatePrediction(1L, "owner@test.com", null, new PredictionDataDTO()));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Dueño puede actualizar su propio pronostico")
    void ownerCanUpdateOwnPrediction() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));
        when(predictionRepository.save(any(Prediction.class))).thenAnswer(inv -> inv.getArgument(0));

        Prediction updated = predictionService.updatePrediction(1L, "owner@test.com", "Nuevo Nombre", null);

        assertNotNull(updated);
        assertEquals("Nuevo Nombre", updated.getName());
        verify(predictionRepository).save(prediction);
    }

    @Test
    @DisplayName("Admin del grupo puede actualizar el pronostico de un miembro")
    void groupAdminCanUpdateMemberPrediction() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));
        when(predictionRepository.save(any(Prediction.class))).thenAnswer(inv -> inv.getArgument(0));

        Prediction updated = predictionService.updatePrediction(1L, "admin@test.com", "Corregido por Admin", null);

        assertNotNull(updated);
        assertEquals("Corregido por Admin", updated.getName());
    }

    @Test
    @DisplayName("Cambiar el cuadro de una porra obliga a recalcular sus puntos")
    void updatingTheBracketClearsTheStoredScore() {
        prediction.setScoreCalculatedAt(java.time.LocalDateTime.now());
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));
        when(predictionRepository.save(any(Prediction.class))).thenAnswer(inv -> inv.getArgument(0));

        predictionService.updatePrediction(1L, "owner@test.com", null, new PredictionDataDTO());

        assertNull(prediction.getScoreCalculatedAt());
    }

    @Test
    @DisplayName("Extraño NO puede actualizar el pronostico de otro usuario (403 SecurityException)")
    void strangerCannotUpdatePrediction() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertThrows(SecurityException.class, () ->
                predictionService.updatePrediction(1L, "stranger@test.com", "Robada", null)
        );

        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Usuario no autenticado (email null) es rechazado")
    void unauthenticatedCannotUpdatePrediction() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertThrows(SecurityException.class, () ->
                predictionService.updatePrediction(1L, null, "Sin Auth", null)
        );
    }

    @Test
    @DisplayName("Participante normal NO puede marcar su propio pronostico como pagado")
    void ownerCannotMarkOwnPredictionAsPaid() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertThrows(SecurityException.class, () ->
                predictionService.markAsPaid(1L, "owner@test.com")
        );

        assertFalse(prediction.getPaid());
        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Admin del grupo sí puede marcar el pronostico de un miembro como pagado")
    void groupAdminCanMarkPredictionAsPaid() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));
        when(predictionRepository.save(any(Prediction.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(groupAdmin));

        Membership membership = Membership.builder().paymentStatus("PENDING").build();
        when(membershipRepository.findById(any())).thenReturn(Optional.of(membership));
        when(predictionRepository.findByUserIdAndEditionLeagueId(owner.getId(), group.getId()))
                .thenReturn(List.of(prediction));
        Prediction paidPrediction = predictionService.markAsPaid(1L, "admin@test.com");

        assertTrue(paidPrediction.getPaid());
        assertEquals("PAID", membership.getPaymentStatus());
        verify(membershipRepository).save(membership);
        assertEquals(groupAdmin, paidPrediction.getPaymentMarkedBy());
        verify(predictionRepository).save(prediction);
    }

    @Test
    @DisplayName("Dueño puede borrar su propio pronostico")
    void ownerCanDeleteOwnPrediction() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        predictionService.deletePrediction(1L, "owner@test.com");

        verify(predictionRepository).delete(prediction);
    }

    @Test
    @DisplayName("Extraño NO puede borrar el pronostico de otro usuario")
    void strangerCannotDeletePrediction() {
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertThrows(SecurityException.class, () ->
                predictionService.deletePrediction(1L, "stranger@test.com")
        );

        verify(predictionRepository, never()).delete(any());
    }

    @Test
    @DisplayName("createPrediction rechaza si el usuario no es miembro de la liga privada")
    void cannotCreatePredictionIfNotMemberOfPrivateLeague() {
        edition.setStatus("ACTIVE");
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        SecurityException ex = assertThrows(SecurityException.class, () ->
                predictionService.createPrediction("stranger@test.com", "Mi Porra", new PredictionDataDTO(), 100L)
        );

        assertTrue(ex.getMessage().contains("No perteneces a esta liga privada"));
        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("cannotCreatePredictionWhenEditionIsLocked")
    void cannotCreatePredictionWhenEditionIsLocked() {
        edition.setStatus("LOCKED");
        when(editionRepository.findByLeagueIdAndStatus(100L, "ACTIVE")).thenReturn(Optional.of(edition));

        assertThrows(IllegalStateException.class, () ->
                predictionService.createPrediction("owner@test.com", "Mi Porra", new PredictionDataDTO(), 100L)
        );

        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("No se puede actualizar pronostico si la edicion/porra ha superado la fecha limite")
    void cannotUpdatePredictionWhenEditionLockDatePassed() {
        edition.setLockDate(LocalDateTime.now().minusHours(2));
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertThrows(IllegalStateException.class, () ->
                predictionService.updatePrediction(1L, "owner@test.com", "Cambio", null)
        );

        verify(predictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Nadie puede actualizar pronostico con la edicion bloqueada")
    void cannotUpdatePredictionWhenEditionIsLocked() {
        edition.setStatus("LOCKED");

        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertThrows(IllegalStateException.class, () ->
                predictionService.updatePrediction(1L, "admin@test.com", "Fix de Admin", null)
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

        assertThrows(SecurityException.class, () ->
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

        assertThrows(SecurityException.class, () -> predictionService.getPredictionData(1L, "stranger@test.com"));
        assertThrows(SecurityException.class, () -> predictionService.getPredictionData(1L, null));
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
    @DisplayName("Los pronósticos de la Porra Global los ve cualquiera tras el cierre")
    void globalLeaguePredictionIsPublicAfterLock() {
        League global = League.builder().id(League.GLOBAL_ID).joinCode(League.GLOBAL_JOIN_CODE).build();
        edition.setLeague(global);
        edition.setStatus("LOCKED");
        when(predictionRepository.findById(1L)).thenReturn(Optional.of(prediction));

        assertNotNull(predictionService.getPredictionData(1L, null));
    }
}
