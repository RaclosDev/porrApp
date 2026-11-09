package app.porrapp.service.league;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.ScorerCandidateDTO;
import app.porrapp.dto.ScorerPickDTO;
import app.porrapp.dto.ScorerPickStateDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.ScorerPick;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.ScorerPickRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.scoring.ScorerChoice;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.tournament.CompetitionPlayerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Pichichi que va dentro del cuadro de un torneo con grupos (el Mundial), como hasta ahora. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ScorerPickServiceTest {

    private static final String ADMIN = "admin@test.invalid";
    private static final String ANA = "ana@test.invalid";

    @Mock private EditionRepository editionRepository;
    @Mock private PredictionRepository predictionRepository;
    @Mock private ScorerPickRepository scorerPickRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private CompetitionPlayerService competitionPlayerService;
    @Mock private LeagueClosure leagueClosure;
    @Mock private ScoreInvalidationService scoreInvalidationService;

    @InjectMocks private ScorerPickService service;

    private final Competition worldCup = Competition.builder().id(2L).name("Mundial")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
    private final Competition laLiga = Competition.builder().id(7L).name("LaLiga").externalId("esp.1")
            .formatType("LEAGUE").build();
    private Edition edition;
    private Prediction prediction;

    @BeforeEach
    void setUp() {
        UserAccount admin = UserAccount.builder().id(1L).googleEmail(ADMIN).participantName("Admin").build();
        UserAccount ana = UserAccount.builder().id(2L).googleEmail(ANA).participantName("Ana").build();
        League league = League.builder().id(10L).name("Los del Mundial").adminUser(admin).build();
        edition = Edition.builder().id(20L).league(league).competition(worldCup).poolFormat(PoolFormat.FULL_BRACKET)
                .pichichi(true).status("ACTIVE").lockDate(Instant.now().plus(5, ChronoUnit.DAYS))
                .createdAt(Instant.now().minus(20, ChronoUnit.DAYS)).build();
        prediction = Prediction.builder().id(30L).user(ana).edition(edition).name("Cuadro de Ana")
                .bracketData(bracket("Ramos", null)).build();
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(predictionRepository.findById(30L)).thenReturn(Optional.of(prediction));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId(ANA, 10L)).thenReturn(Optional.of(prediction));
        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of(prediction));
        when(scorerPickRepository.findById(any())).thenReturn(Optional.empty());
        when(scorerPickRepository.findByEditionId(20L)).thenReturn(List.of());
        squads(true);
    }

    private void squads(boolean known) {
        when(competitionPlayerService.squadsKnown(any())).thenReturn(known);
        when(competitionPlayerService.players(any(Competition.class))).thenReturn(known ? List.of(
                new ScorerCandidateDTO("p-mbappe", "Kylian Mbappé", "K. Mbappé", "Francia", "F", 0),
                new ScorerCandidateDTO("p-goncalo", "Gonçalo Ramos", "G. Ramos", "Portugal", "F", 0),
                new ScorerCandidateDTO("p-sergio", "Sergio Ramos", "S. Ramos", "España", "D", 0)) : List.of());
    }

    private static PredictionDataDTO bracket(String scorer, String playerId) {
        PredictionDataDTO bracket = new PredictionDataDTO();
        bracket.setScorer(scorer);
        bracket.setScorerPlayerId(playerId);
        return bracket;
    }

    @Test
    @DisplayName("El jugador elegido de la lista viaja en el cuadro con su nombre tal cual es")
    void aPlayerChosenFromTheListIsKeptInTheBracket() {
        PredictionDataDTO bracket = bracket("mbappe", "p-mbappe");

        service.prepareBracketScorer(edition, bracket);

        assertThat(bracket.getScorer()).isEqualTo("Kylian Mbappé");
        assertThat(bracket.getScorerPlayerId()).isEqualTo("p-mbappe");
    }

    @Test
    @DisplayName("Lo escrito a mano queda como el jugador real si encaja con uno solo de las plantillas")
    void aWrittenNameIsPinnedToItsPlayer() {
        PredictionDataDTO written = bracket("  k. mbape ", null);
        PredictionDataDTO doubtful = bracket("Ramos", null);
        PredictionDataDTO unknownId = bracket("Sergio Ramos", "p-de-otro-torneo");

        service.prepareBracketScorer(edition, written);
        service.prepareBracketScorer(edition, doubtful);
        service.prepareBracketScorer(edition, unknownId);

        assertThat(written.getScorer()).isEqualTo("Kylian Mbappé");
        assertThat(written.getScorerPlayerId()).isEqualTo("p-mbappe");
        assertThat(doubtful.getScorer()).isEqualTo("Ramos");
        assertThat(doubtful.getScorerPlayerId()).isNull();
        // Un id que no es de la lista no vale: se queda con lo escrito.
        assertThat(unknownId.getScorerPlayerId()).isEqualTo("p-sergio");
    }

    @Test
    @DisplayName("Sin plantillas el cuadro guarda lo escrito, que se empareja con los goleadores al puntuar")
    void withoutSquadsTheWrittenNameIsKeptAsIs() {
        squads(false);
        PredictionDataDTO bracket = bracket("mbape", null);

        service.prepareBracketScorer(edition, bracket);

        assertThat(bracket.getScorer()).isEqualTo("mbape");
        assertThat(bracket.getScorerPlayerId()).isNull();
    }

    @Test
    @DisplayName("Un cuadro de una liga que no elige el pichichi dentro no lleva jugador, y un nombre desmesurado no entra")
    void aBracketWithoutPichichiCarriesNoPlayer() {
        Edition matchday = Edition.builder().id(21L).competition(laLiga).poolFormat(PoolFormat.MATCH_DAY)
                .pichichi(true).status("ACTIVE").build();
        PredictionDataDTO bracket = bracket("Mbappé", "p-mbappe");

        service.prepareBracketScorer(matchday, bracket);
        service.prepareBracketScorer(edition, null);

        assertThat(bracket.getScorerPlayerId()).isNull();
        assertThatThrownBy(() -> service.prepareBracketScorer(edition, bracket("x".repeat(121), null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("El pichichi del cuadro se cierra con el cuadro y no se guarda aparte")
    void theBracketPickLocksWithTheBracket() {
        ScorerPickStateDTO state = service.state(10L, ANA);

        assertThat(state.enabled()).isTrue();
        assertThat(state.inBracket()).isTrue();
        assertThat(state.locked()).isFalse();
        assertThat(state.lockAt()).isEqualTo(edition.getLockDate());
        assertThat(state.mine().status()).isEqualTo(ScorerPickDTO.DOUBTFUL);
        when(userAccountRepository.findByGoogleEmail(ANA)).thenReturn(Optional.of(prediction.getUser()));
        assertThatThrownBy(() -> service.save(10L, ANA, "Mbappé", null)).isInstanceOf(BusinessException.class);
        verify(scorerPickRepository, never()).save(any());
    }

    @Test
    @DisplayName("El administrador asigna el jugador de un pichichi dudoso del cuadro sin tocar el cuadro")
    void theAdminAssignsADoubtfulBracketPick() {
        edition.setLockDate(Instant.now().minus(1, ChronoUnit.DAYS));

        ScorerPickDTO assigned = service.assign(10L, 30L, "p-goncalo", ADMIN);

        ArgumentCaptor<ScorerPick> saved = ArgumentCaptor.forClass(ScorerPick.class);
        verify(scorerPickRepository).save(saved.capture());
        assertThat(saved.getValue().getPredictionId()).isEqualTo(30L);
        assertThat(saved.getValue().getWrittenName()).isEqualTo("Ramos");
        assertThat(saved.getValue().getPlayerId()).isEqualTo("p-goncalo");
        assertThat(saved.getValue().isResolvedByAdmin()).isTrue();
        assertThat(assigned.status()).isEqualTo(ScorerPickDTO.PLAYER);
        assertThat(assigned.playerName()).isEqualTo("Gonçalo Ramos");
        assertThat(assigned.byAdmin()).isTrue();
        assertThat(prediction.getBracketData().getScorer()).isEqualTo("Ramos");
        verify(scoreInvalidationService).invalidateEdition(20L);

        // Lo asignado vale mientras el cuadro siga diciendo lo mismo.
        ScorerChoice choice = ScorerChoice.of(edition, prediction, saved.getValue());
        assertThat(choice.playerId()).isEqualTo("p-goncalo");
        assertThat(choice.byAdmin()).isTrue();
        prediction.setBracketData(bracket("Mbappé", null));
        assertThat(ScorerChoice.of(edition, prediction, saved.getValue()).hasPlayer()).isFalse();
    }

    @Test
    @DisplayName("Quitar lo asignado en un cuadro borra la fila y el pichichi vuelve a quedar dudoso")
    void clearingAnAssignedBracketPickDeletesIt() {
        edition.setLockDate(Instant.now().minus(1, ChronoUnit.DAYS));
        ScorerPick row = ScorerPick.builder().predictionId(30L).writtenName("Ramos").playerId("p-goncalo")
                .playerName("Gonçalo Ramos").resolvedByAdmin(true).build();
        when(scorerPickRepository.findById(30L)).thenReturn(Optional.of(row));

        ScorerPickDTO cleared = service.assign(10L, 30L, " ", ADMIN);

        verify(scorerPickRepository).delete(row);
        assertThat(cleared.status()).isEqualTo(ScorerPickDTO.DOUBTFUL);
        assertThat(cleared.candidates()).extracting(ScorerCandidateDTO::name)
                .containsExactlyInAnyOrder("Gonçalo Ramos", "Sergio Ramos");
    }

    @Test
    @DisplayName("Solo el administrador, con el plazo cerrado y la liga sin terminar, y solo en predicciones de su liga")
    void assigningIsGuarded() {
        assertThatThrownBy(() -> service.assign(10L, 30L, "p-goncalo", ANA)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.assign(10L, 30L, "p-goncalo", ADMIN))
                .as("plazo abierto").isInstanceOf(BusinessException.class);

        edition.setLockDate(Instant.now().minus(1, ChronoUnit.DAYS));
        when(predictionRepository.findById(31L)).thenReturn(Optional.of(Prediction.builder().id(31L)
                .edition(Edition.builder().id(99L).build()).bracketData(bracket("Ramos", null)).build()));
        assertThatThrownBy(() -> service.assign(10L, 31L, "p-goncalo", ADMIN))
                .as("predicción de otra liga").isInstanceOf(BusinessException.class);

        when(leagueClosure.isFinished(any(), any())).thenReturn(true);
        assertThatThrownBy(() -> service.assign(10L, 30L, "p-goncalo", ADMIN))
                .as("liga terminada").isInstanceOf(BusinessException.class);
        verify(scorerPickRepository, never()).save(any());
    }

    @Test
    @DisplayName("Una liga que no juega el pichichi no enseña ni deja asignar nada")
    void aLeagueWithoutPichichiHasNothing() {
        edition.setPichichi(false);

        assertThat(service.state(10L, ANA).enabled()).isFalse();
        assertThat(service.picks(10L, ADMIN)).isEmpty();
        assertThatThrownBy(() -> service.assign(10L, 30L, "p-goncalo", ADMIN)).isInstanceOf(BusinessException.class);
    }
}
