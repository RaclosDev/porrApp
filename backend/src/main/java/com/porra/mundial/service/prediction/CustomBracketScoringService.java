package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.scoring.ScoringRuleSet;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomBracketScoringService {
    private final MatchRepository matches;
    private final TeamRepository teams;

    public ParticipantScoreDTO score(Prediction prediction) {
        ParticipantScoreDTO score = ParticipantScoreDTO.builder()
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).matchPoints(0).total(0)
                .log(new java.util.ArrayList<>()).exactMatches(new java.util.HashMap<>())
                .passedTeams(new java.util.HashMap<>()).build();
        PredictionDataDTO data = prediction.getBracketData();
        if (data == null || data.getCustomRounds() == null) return score;
        if (DrawnKnockout.applies(prediction.getEdition())) return scoreDrawn(prediction, data, score);
        Long competitionId = prediction.getEdition().getCompetition().getId();
        List<Match> all = matches.findByCompetitionId(competitionId);
        ScoringRuleSet rules = ScoringRuleSet.effectiveForEdition(prediction.getEdition());
        List<List<Match>> byRound = PredictableBracket.rounds(prediction.getEdition().getCompetition(), all);
        int knockoutPoints = 0;
        for (int index = 0; index < data.getCustomRounds().size(); index++) {
            Set<String> winners = (index < byRound.size() ? byRound.get(index) : List.<Match>of()).stream()
                    .filter(match -> Boolean.TRUE.equals(match.getFinished()) && match.getWinnerTeam() != null)
                    .map(match -> match.getWinnerTeam().getName())
                    .collect(Collectors.toSet());
            List<String> picks = data.getCustomRounds().get(index);
            for (String pick : picks) {
                if (winners.contains(pick)) {
                    int distanceFromFinal = data.getCustomRounds().size() - 1 - index;
                    int points = switch (distanceFromFinal) {
                        case 0 -> rules.getChampionPoints();
                        case 1 -> rules.getSemiFinalPoints();
                        case 2 -> rules.getQuarterFinalPoints();
                        case 3 -> rules.getRoundOf16Points();
                        default -> rules.getRoundOf32Points();
                    };
                    knockoutPoints += points;
                    score.getLog().add(ParticipantScoreDTO.LogEntry.builder()
                            .stage("cuadro").amount(points)
                            .msg("Ganador acertado: " + pick).build());
                }
            }
        }
        score.setR32(knockoutPoints);
        int groupPoints = scoreGroups(data, all, competitionId, rules, score);
        score.setR1(groupPoints);
        score.setTotal(knockoutPoints + groupPoints);
        return score;
    }

    /** Eliminatorias sorteadas ronda a ronda: suma cada cruce en el que pasa el equipo elegido. */
    private ParticipantScoreDTO scoreDrawn(Prediction prediction, PredictionDataDTO data, ParticipantScoreDTO score) {
        List<DrawnKnockout.Round> rounds = DrawnKnockout.rounds(prediction.getEdition(),
                matches.findByCompetitionId(prediction.getEdition().getCompetition().getId()));
        ScoringRuleSet rules = ScoringRuleSet.effectiveForEdition(prediction.getEdition());
        int total = 0;
        for (int index = 0; index < Math.min(rounds.size(), data.getCustomRounds().size()); index++) {
            DrawnKnockout.Round round = rounds.get(index);
            List<String> picks = data.getCustomRounds().get(index);
            if (picks == null) continue;
            for (int tie = 0; tie < Math.min(picks.size(), round.ties().size()); tie++) {
                Team winner = round.ties().get(tie).winner();
                String pick = picks.get(tie);
                if (pick == null || winner == null || !pick.equals(winner.getName())) continue;
                if (round.series()) {
                    total += scoreSeries(round, tie, pick, seriesGames(data, index, tie), rules, score);
                    continue;
                }
                int points = DrawnKnockout.points(round.key(), rules);
                total += points;
                score.getLog().add(ParticipantScoreDTO.LogEntry.builder().stage("cuadro").amount(points)
                        .msg("final".equals(round.key()) ? "Campeón acertado: " + pick
                                : DrawnKnockout.title(round.key()) + ": acertado que pasa " + pick)
                        .build());
            }
        }
        score.setR32(total);
        score.setTotal(total);
        return score;
    }

    /**
     * Serie de la NBA acertada: los puntos de la ronda y, si además se acertó en cuántos partidos, el extra.
     *
     * @return puntos sumados
     */
    private static int scoreSeries(DrawnKnockout.Round round, int tie, String pick, Integer games,
                                   ScoringRuleSet rules, ParticipantScoreDTO score) {
        String title = DrawnKnockout.seriesTitle(round.key());
        int points = DrawnKnockout.seriesPoints(round.key(), rules);
        score.getLog().add(ParticipantScoreDTO.LogEntry.builder().stage("cuadro").amount(points)
                .msg("final".equals(round.key()) ? "Campeón acertado: " + pick
                        : title + ": acertado que gana " + pick)
                .build());
        int played = round.ties().get(tie).gamesPlayed();
        int needed = round.bestOf() / 2 + 1;
        int exact = DrawnKnockout.seriesExactPoints(round.key(), rules);
        if (round.bestOf() > 1 && games != null && games == played && exact > 0) {
            score.getLog().add(ParticipantScoreDTO.LogEntry.builder().stage("cuadro").amount(exact)
                    .msg(title + ": serie exacta, " + pick + " gana " + needed + "-" + (played - needed))
                    .build());
            return points + exact;
        }
        return points;
    }

    private static Integer seriesGames(PredictionDataDTO data, int round, int tie) {
        List<List<Integer>> games = data.getCustomSeriesGames();
        if (games == null || round >= games.size() || games.get(round) == null) return null;
        List<Integer> row = games.get(round);
        return tie < row.size() ? row.get(tie) : null;
    }

    private int scoreGroups(PredictionDataDTO data, List<Match> all, Long competitionId,
                            ScoringRuleSet rules, ParticipantScoreDTO score) {
        if (data.getGroups() == null || data.getGroups().isEmpty()) return 0;
        Map<String, List<Team>> byGroup = teams.findByCompetitionIdOrderByNameAsc(competitionId).stream()
                .filter(team -> team.getGroupName() != null)
                .collect(Collectors.groupingBy(Team::getGroupName));
        int points = 0;
        for (var group : byGroup.entrySet()) {
            List<Match> fixtures = all.stream().filter(match -> "group".equals(match.getRound())
                    && group.getKey().equals(match.getGroupName())).toList();
            if (fixtures.isEmpty() || fixtures.stream().anyMatch(match -> !Boolean.TRUE.equals(match.getFinished()))) {
                continue;
            }
            Map<String, int[]> table = new java.util.HashMap<>();
            group.getValue().forEach(team -> table.put(team.getName(), new int[3]));
            for (Match match : fixtures) {
                if (match.getHomeTeam() == null || match.getAwayTeam() == null
                        || match.getHomeScore() == null || match.getAwayScore() == null) continue;
                int[] home = table.get(match.getHomeTeam().getName());
                int[] away = table.get(match.getAwayTeam().getName());
                if (home == null || away == null) continue;
                home[0] += match.getHomeScore() > match.getAwayScore() ? 3
                        : match.getHomeScore().equals(match.getAwayScore()) ? 1 : 0;
                away[0] += match.getAwayScore() > match.getHomeScore() ? 3
                        : match.getHomeScore().equals(match.getAwayScore()) ? 1 : 0;
                home[1] += match.getHomeScore() - match.getAwayScore();
                away[1] += match.getAwayScore() - match.getHomeScore();
                home[2] += match.getHomeScore();
                away[2] += match.getAwayScore();
            }
            List<String> actual = table.keySet().stream().sorted((left, right) -> {
                for (int field = 0; field < 3; field++) {
                    int comparison = Integer.compare(table.get(right)[field], table.get(left)[field]);
                    if (comparison != 0) return comparison;
                }
                return left.compareTo(right);
            }).toList();
            List<String> predicted = data.getGroups().get(group.getKey());
            if (predicted == null) continue;
            for (int index = 0; index < Math.min(actual.size(), predicted.size()); index++) {
                String team = actual.get(index);
                int[] row = table.get(team);
                boolean tied = (index > 0 && java.util.Arrays.equals(row, table.get(actual.get(index - 1))))
                        || (index + 1 < actual.size() && java.util.Arrays.equals(row, table.get(actual.get(index + 1))));
                if (!tied && team.equals(predicted.get(index))) {
                    points += rules.getGroupExactPositionPoints();
                    score.getLog().add(ParticipantScoreDTO.LogEntry.builder().stage("grupos")
                            .amount(rules.getGroupExactPositionPoints())
                            .msg("Posición acertada en el grupo " + group.getKey() + ": " + team).build());
                }
            }
        }
        return points;
    }
}
