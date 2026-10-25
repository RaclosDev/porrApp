package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio de persistencia y deserializacion de pronosticos estructurados.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PredictionPersistenceService {

    private final TeamRepository teamRepository;
    private final PredictionRepository predictionRepository;
    private final GroupPredictionRepository groupPredictionRepository;
    private final BracketPredictionRepository bracketPredictionRepository;
    private final ExtraPredictionRepository extraPredictionRepository;

    @Transactional
    public void saveRelationalPredictions(Prediction prediction, PredictionDataDTO dto) {
        if (dto == null || prediction == null) return;

        try {
            cleanOldPredictions(prediction.getId());

            Set<String> legacyThirds = new HashSet<>();
            if (dto.getThirds() != null) {
                legacyThirds.addAll(dto.getThirds());
            }

            if (dto.getGroups() != null) {
                for (Map.Entry<String, List<String>> entry : dto.getGroups().entrySet()) {
                    String groupName = entry.getKey() != null && !"-".equals(entry.getKey()) ? entry.getKey().toUpperCase().trim() : null;
                    if (groupName == null || "-".equals(groupName)) continue;
                    List<String> teamsList = entry.getValue();
                    for (int i = 0; i < teamsList.size(); i++) {
                        String teamName = teamsList.get(i);
                        Team team = getTeamByName(teamName);
                        if (team != null) {
                            boolean isBest = legacyThirds.contains(teamName);
                            groupPredictionRepository.save(GroupPrediction.builder()
                                    .prediction(prediction)
                                    .groupName(groupName)
                                    .team(team)
                                    .position(i + 1)
                                    .isBestThird(isBest)
                                    .build());
                        }
                    }
                }
            }

            saveBracketPhase(prediction, dto.getR32(), "R32", dto.getFlatR16());
            saveBracketPhase(prediction, dto.getR16(), "R16", dto.getFlatQf());
            saveBracketPhase(prediction, dto.getQf(), "QF", dto.getFlatSf());
            saveBracketPhase(prediction, dto.getSf(), "SF", dto.getFinalMatch());

            if (dto.getFinalMatch() != null && dto.getFinalMatch().size() == 2) {
                saveBracketSingleMatch(prediction, dto.getFinalMatch(), "FINAL", dto.getChampion());
            }
            if (dto.getThirdPlaceMatch() != null && dto.getThirdPlaceMatch().size() == 2) {
                saveBracketSingleMatch(prediction, dto.getThirdPlaceMatch(), "THIRD_PLACE", dto.getThirdPlaceWinner());
            }

            Team championTeam = getTeamByName(dto.getChampion());
            Team thirdPlaceTeam = getTeamByName(dto.getThirdPlaceWinner());

            if (championTeam != null) {
                extraPredictionRepository.save(ExtraPrediction.builder()
                        .prediction(prediction)
                        .topScorer(dto.getScorer())
                        .championTeam(championTeam)
                        .thirdPlaceTeam(thirdPlaceTeam)
                        .build());
            }

        } catch (Exception e) {
            log.error("Fallo crítico persistiendo tablas relacionales para prediction_id={}: {}", prediction.getId(), e.getMessage(), e);
            throw new IllegalStateException("No se pudo persistir el desglose del pronóstico relacional: " + e.getMessage(), e);
        }
    }

    private void cleanOldPredictions(Long predictionId) {
        groupPredictionRepository.deleteAll(groupPredictionRepository.findByPredictionId(predictionId));
        bracketPredictionRepository.deleteAll(bracketPredictionRepository.findByPredictionId(predictionId));
        extraPredictionRepository.findById(predictionId).ifPresent(extraPredictionRepository::delete);
    }

    private void saveBracketPhase(Prediction prediction, List<List<String>> phaseArray, String dbPhaseName, List<String> nextPhaseWinners) {
        if (phaseArray == null) return;

        for (int i = 0; i < phaseArray.size(); i++) {
            List<String> match = phaseArray.get(i);
            if (match.size() >= 2) {
                String homeName = match.get(0);
                String awayName = match.get(1);
                Team home = getTeamByName(homeName);
                Team away = getTeamByName(awayName);

                String winnerName = findWinnerInNextPhaseList(homeName, awayName, nextPhaseWinners);
                Team winner = getTeamByName(winnerName);

                if (home != null || away != null || winner != null) {
                    bracketPredictionRepository.save(BracketPrediction.builder()
                            .prediction(prediction)
                            .phase(dbPhaseName)
                            .matchIndex(i)
                            .homeTeam(home)
                            .awayTeam(away)
                            .winnerTeam(winner)
                            .build());
                }
            }
        }
    }

    private void saveBracketSingleMatch(Prediction prediction, List<String> match, String dbPhaseName, String winnerName) {
        if (match == null || match.size() < 2) return;

        String homeName = match.get(0);
        String awayName = match.get(1);

        Team home = getTeamByName(homeName);
        Team away = getTeamByName(awayName);
        Team winner = getTeamByName(winnerName);

        if (home != null || away != null || winner != null) {
            bracketPredictionRepository.save(BracketPrediction.builder()
                    .prediction(prediction)
                    .phase(dbPhaseName)
                    .matchIndex(0)
                    .homeTeam(home)
                    .awayTeam(away)
                    .winnerTeam(winner)
                    .build());
        }
    }

    private String findWinnerInNextPhaseList(String team1, String team2, List<String> nextPhaseWinners) {
        if (nextPhaseWinners == null) return team1;

        for (String t : nextPhaseWinners) {
            if (team1.equals(t)) return team1;
            if (team2.equals(t)) return team2;
        }

        return team1;
    }

    private Team getTeamByName(String name) {
        if (name == null) return null;
        return teamRepository.findByName(name).orElseGet(() ->
            teamRepository.findByNameEn(name).orElse(null)
        );
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "rebuiltPredictionData", key = "#predictionId")
    public PredictionDataDTO rebuildPredictionDataDtoFromTables(Long predictionId) {
        PredictionDataDTO dto = new PredictionDataDTO();

        List<GroupPrediction> groupPreds = groupPredictionRepository.findByPredictionId(predictionId);
        Map<String, List<String>> groupsMap = new LinkedHashMap<>();
        for (GroupPrediction gp : groupPreds) {
            if (gp.getGroupName() != null && !"-".equals(gp.getGroupName())) {
                groupsMap.putIfAbsent(gp.getGroupName().toUpperCase().trim(), new ArrayList<>());
            }
        }

        groupPreds.sort(Comparator.comparingInt(GroupPrediction::getPosition));
        for (GroupPrediction gp : groupPreds) {
            if (gp.getTeam() != null && gp.getGroupName() != null && !"-".equals(gp.getGroupName())) {
                groupsMap.get(gp.getGroupName().toUpperCase().trim()).add(gp.getTeam().getName());
            }
        }
        dto.setGroups(groupsMap);

        List<String> thirds = new ArrayList<>();
        for (GroupPrediction gp : groupPreds) {
            if (Boolean.TRUE.equals(gp.getIsBestThird()) && gp.getTeam() != null) {
                thirds.add(gp.getTeam().getName());
            }
        }
        dto.setThirds(thirds);

        List<BracketPrediction> bracketPreds = bracketPredictionRepository.findByPredictionId(predictionId);

        List<List<String>> r32 = buildPhaseArray(bracketPreds, "R32");
        if (r32.isEmpty()) {
            r32 = reconstructR32(dto.getGroups(), dto.getThirds());
        }
        dto.setR32(r32);

        dto.setR16(buildPhaseArray(bracketPreds, "R16"));
        dto.setQf(buildPhaseArray(bracketPreds, "QF"));
        dto.setSf(buildPhaseArray(bracketPreds, "SF"));

        BracketPrediction finalMatch = bracketPreds.stream().filter(p -> "FINAL".equals(p.getPhase())).findFirst().orElse(null);
        if (finalMatch != null && (finalMatch.getHomeTeam() != null || finalMatch.getAwayTeam() != null)) {
            dto.setFinalMatch(Arrays.asList(
                    finalMatch.getHomeTeam() != null ? finalMatch.getHomeTeam().getName() : null,
                    finalMatch.getAwayTeam() != null ? finalMatch.getAwayTeam().getName() : null
            ));
        }

        BracketPrediction thirdPlace = bracketPreds.stream().filter(p -> "THIRD_PLACE".equals(p.getPhase())).findFirst().orElse(null);
        if (thirdPlace != null && (thirdPlace.getHomeTeam() != null || thirdPlace.getAwayTeam() != null)) {
            dto.setThirdPlaceMatch(Arrays.asList(
                    thirdPlace.getHomeTeam() != null ? thirdPlace.getHomeTeam().getName() : null,
                    thirdPlace.getAwayTeam() != null ? thirdPlace.getAwayTeam().getName() : null
            ));
        }

        extraPredictionRepository.findById(predictionId).ifPresent(extra -> {
            dto.setScorer(extra.getTopScorer());
            if (extra.getChampionTeam() != null) {
                dto.setChampion(extra.getChampionTeam().getName());
            }
            if (extra.getThirdPlaceTeam() != null) {
                dto.setThirdPlaceWinner(extra.getThirdPlaceTeam().getName());
            }
        });

        return dto;
    }

    @Deprecated
    public PredictionDataDTO rebuildBetDataDtoFromTables(Long predictionId) {
        return rebuildPredictionDataDtoFromTables(predictionId);
    }

    private List<List<String>> reconstructR32(Map<String, List<String>> groups, List<String> thirds) {
        if (groups == null || groups.isEmpty()) return Collections.emptyList();
        List<List<String>> dummyR32 = new ArrayList<>();
        return dummyR32;
    }

    private List<List<String>> buildPhaseArray(List<BracketPrediction> preds, String phase) {
        List<BracketPrediction> filtered = preds.stream()
                .filter(p -> phase.equalsIgnoreCase(p.getPhase()))
                .sorted(Comparator.comparingInt(BracketPrediction::getMatchIndex))
                .collect(Collectors.toList());

        if (filtered.isEmpty()) return Collections.emptyList();

        List<List<String>> result = new ArrayList<>();
        for (BracketPrediction bp : filtered) {
            String home = bp.getHomeTeam() != null ? bp.getHomeTeam().getName() : null;
            String away = bp.getAwayTeam() != null ? bp.getAwayTeam().getName() : null;
            result.add(Arrays.asList(home, away));
        }
        return result;
    }
}
