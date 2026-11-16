package app.porrapp.service.formulaone;

import app.porrapp.model.Edition;
import app.porrapp.model.Match;
import app.porrapp.model.MatchPrediction;
import app.porrapp.model.Prediction;
import app.porrapp.model.RaceDriver;
import app.porrapp.model.RaceWeekend;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.RaceDriverRepository;
import app.porrapp.repository.RaceWeekendRepository;
import app.porrapp.service.prediction.ScoreInvalidationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GrandPrixScoringServiceTest {

    @Mock MatchPredictionRepository matchPredictions;
    @Mock PredictionRepository predictions;
    @Mock RaceWeekendRepository weekends;
    @Mock RaceDriverRepository drivers;
    @Mock ScoreInvalidationService invalidation;
    @InjectMocks GrandPrixScoringService service;

    @Test
    @DisplayName("Guarda los puntos del GP en la fila, marca la porra para recalcular y tira la clasificación")
    void scoresTheWeekendAndInvalidates() {
        Match race = Match.builder().id(9L).round("GP de Mónaco").build();
        Prediction prediction = Prediction.builder().id(5L).edition(Edition.builder().id(3L).build())
                .scoreCalculatedAt(Instant.now()).build();
        MatchPrediction pick = MatchPrediction.builder().match(race).prediction(prediction).raceFirstDriverId(1L)
                .isExactScore(true).build();
        RaceWeekend result = RaceWeekend.builder().matchId(9L).firstDriverId(1L).secondDriverId(2L)
                .thirdDriverId(3L).build();
        when(matchPredictions.findByMatchId(9L)).thenReturn(List.of(pick));
        when(drivers.findAllById(any())).thenReturn(List.of(RaceDriver.builder().id(1L).shortName("L. Norris").build()));

        assertThat(service.scoreWeekend(race, result)).isEqualTo(1);

        assertThat(pick.getPointsAwarded()).isEqualTo(10);
        assertThat(pick.getScoringDetails()).isEqualTo("GP de Mónaco: L. Norris 1.º (+10)");
        assertThat(pick.getIsExactScore()).isNull();
        assertThat(prediction.getScoreCalculatedAt()).isNull();
        verify(matchPredictions).saveAll(List.of(pick));
        verify(invalidation).evictLeaderboardAfterCommit();
    }

    @Test
    @DisplayName("Sin podio no toca nada")
    void withoutPodiumDoesNothing() {
        assertThat(service.scoreWeekend(Match.builder().id(9L).build(), RaceWeekend.builder().matchId(9L).build()))
                .isZero();
        verify(matchPredictions, never()).findByMatchId(any());
    }
}
