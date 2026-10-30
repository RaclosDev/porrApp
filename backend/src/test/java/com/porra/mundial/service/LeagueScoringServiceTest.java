package com.porra.mundial.service;

import com.porra.mundial.dto.LeagueScoringDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.scoring.ScoringRuleSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LeagueScoringServiceTest {

    private static final String ADMIN = "admin@test.com";
    private static final String MEMBER = "member@test.com";

    @Mock
    private LeagueRepository leagueRepository;
    @Mock
    private EditionRepository editionRepository;
    @Mock
    private GroupService groupService;
    @Mock
    private MatchPredictionService matchPredictionService;
    @Mock
    private ScoreInvalidationService scoreInvalidationService;

    @InjectMocks
    private LeagueScoringService leagueScoringService;

    private League league;
    private Edition edition;

    @BeforeEach
    void setUp() {
        league = League.builder().id(10L).name("Liga de amigos").joinCode("AMIGOS")
                .adminUser(UserAccount.builder().id(1L).googleEmail(ADMIN).build()).build();
        edition = Edition.builder().id(100L).league(league).poolFormat(PoolFormat.MATCH_DAY).pichichi(false)
                .scoringRulesJson(ScoringRuleSet.defaultWorldCup2026().toJson()).build();
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
    }

    private void globalLeague() {
        League global = League.builder().id(League.GLOBAL_ID).name(League.GLOBAL_NAME).joinCode(League.GLOBAL_JOIN_CODE)
                .adminUser(UserAccount.builder().id(1L).googleEmail(ADMIN).build()).build();
        when(leagueRepository.findById(League.GLOBAL_ID)).thenReturn(Optional.of(global));
        when(editionRepository.findByLeagueIdAndStatus(League.GLOBAL_ID, "ACTIVE")).thenReturn(Optional.of(
                Edition.builder().id(1L).league(global).poolFormat(PoolFormat.FULL_BRACKET).build()));
    }

    @Test
    @DisplayName("Un miembro ve la puntuación de su liga, con las reglas por defecto, pero no puede cambiarla")
    void memberReadsTheRulesWithoutEditing() {
        LeagueScoringDTO scoring = leagueScoringService.getScoring(10L, MEMBER);

        verify(groupService).assertCanView(10L, MEMBER);
        assertFalse(scoring.editable());
        assertEquals("MATCH_DAY", scoring.poolFormat());
        assertFalse(scoring.pichichi());
        assertEquals(ScoringRuleSet.MAX_POINTS, scoring.maxPoints());
        assertEquals(ScoringRuleSet.defaultWorldCup2026(), scoring.rules());
        assertEquals(ScoringRuleSet.defaultWorldCup2026(), scoring.defaults());
    }

    @Test
    void adminCanEditTheRules() {
        assertTrue(leagueScoringService.getScoring(10L, "ADMIN@test.com").editable());
    }

    @Test
    @DisplayName("Quien no pertenece a una liga privada no ve su puntuación")
    void outsidersCannotReadAPrivateLeague() {
        doThrow(new SecurityException("No perteneces a esta liga privada"))
                .when(groupService).assertCanView(10L, "intruso@test.com");

        assertThrows(SecurityException.class, () -> leagueScoringService.getScoring(10L, "intruso@test.com"));
    }

    @Test
    void unknownLeagueIsNotFound() {
        assertThrows(NoSuchElementException.class, () -> leagueScoringService.getScoring(99L, MEMBER));
    }

    @Test
    @DisplayName("La puntuación de la Porra Global es de solo lectura, también para su administrador")
    void globalLeagueIsReadOnly() {
        globalLeague();

        assertFalse(leagueScoringService.getScoring(League.GLOBAL_ID, ADMIN).editable());
        SecurityException error = assertThrows(SecurityException.class, () -> leagueScoringService.updateScoring(
                League.GLOBAL_ID, ScoringRuleSet.builder().championPoints(300).build(), ADMIN));
        assertTrue(error.getMessage().contains("Porra Global"));
        verify(editionRepository, never()).save(any());
        verifyNoInteractions(matchPredictionService, scoreInvalidationService);
    }

    @Test
    @DisplayName("Solo el administrador puede cambiar la puntuación")
    void onlyTheAdminCanChangeTheRules() {
        ScoringRuleSet rules = ScoringRuleSet.builder().exactScorePoints(8).build();

        assertThrows(SecurityException.class, () -> leagueScoringService.updateScoring(10L, rules, MEMBER));
        assertThrows(SecurityException.class, () -> leagueScoringService.updateScoring(10L, rules, null));
        assertEquals(ScoringRuleSet.defaultWorldCup2026(), ScoringRuleSet.forEdition(edition));
        verify(editionRepository, never()).save(any());
        verifyNoInteractions(matchPredictionService, scoreInvalidationService);
    }

    @Test
    @DisplayName("Una regla fuera de rango no se guarda")
    void outOfRangeRulesAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> leagueScoringService.updateScoring(10L,
                ScoringRuleSet.builder().correctSignPoints(-1).build(), ADMIN));
        assertThrows(IllegalArgumentException.class, () -> leagueScoringService.updateScoring(10L,
                ScoringRuleSet.builder().exactScorePoints(ScoringRuleSet.MAX_POINTS + 1).build(), ADMIN));
        assertThrows(IllegalArgumentException.class, () -> leagueScoringService.updateScoring(10L, null, ADMIN));

        verify(editionRepository, never()).save(any());
        verifyNoInteractions(matchPredictionService, scoreInvalidationService);
    }

    @Test
    @DisplayName("Al cambiar la puntuación se repuntúan los partidos y se invalidan las puntuaciones guardadas")
    void changingTheRulesRecalculatesThePoints() {
        ScoringRuleSet rules = ScoringRuleSet.builder().exactScorePoints(8).correctSignPoints(2).build();

        LeagueScoringDTO scoring = leagueScoringService.updateScoring(10L, rules, ADMIN);

        assertEquals(rules, ScoringRuleSet.forEdition(edition));
        assertEquals(rules, scoring.rules());
        assertTrue(scoring.editable());
        var inOrder = inOrder(editionRepository, matchPredictionService, scoreInvalidationService);
        inOrder.verify(editionRepository).save(edition);
        inOrder.verify(matchPredictionService).rescoreEdition(edition);
        inOrder.verify(scoreInvalidationService).invalidateEdition(100L);
    }

    @Test
    @DisplayName("Guardar las mismas reglas no recalcula nada")
    void savingTheSameRulesChangesNothing() {
        LeagueScoringDTO scoring = leagueScoringService.updateScoring(10L, ScoringRuleSet.defaultWorldCup2026(), ADMIN);

        assertEquals(ScoringRuleSet.defaultWorldCup2026(), scoring.rules());
        verify(editionRepository, never()).save(any());
        verifyNoInteractions(matchPredictionService, scoreInvalidationService);
    }

    @Test
    @DisplayName("Una edición sin reglas guardadas que recibe las de por defecto no se recalcula")
    void editionWithoutStoredRulesAndDefaultsIsUnchanged() {
        edition.setScoringRulesJson(null);

        leagueScoringService.updateScoring(10L, ScoringRuleSet.defaultWorldCup2026(), ADMIN);

        verifyNoInteractions(matchPredictionService, scoreInvalidationService);
    }
}
