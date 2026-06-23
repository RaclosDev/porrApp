package com.porra.mundial.service;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class HashTransitionService {

    private final TeamRepository teamRepository;
    private final BetRepository betRepository;
    private final GroupPredictionRepository groupPredictionRepository;
    private final BracketPredictionRepository bracketPredictionRepository;
    private final ExtraPredictionRepository extraPredictionRepository;

    @Transactional
    public void saveRelationalPredictions(Bet bet, BetDataDTO dto) {
        if (dto == null) return;
        
        try {
            // Clean old predictions for this bet if re-saving
            cleanOldPredictions(bet.getId());

            // Parse Thirds array (which 3rd places advanced)
            Set<String> legacyThirds = new HashSet<>();
            if (dto.getThirds() != null) {
                legacyThirds.addAll(dto.getThirds());
            }

            // 2. Parse Groups (pronosticos_grupo)
            if (dto.getGroups() != null) {
                for (Map.Entry<String, List<String>> entry : dto.getGroups().entrySet()) {
                    String groupName = entry.getKey();
                    List<String> teamsList = entry.getValue();
                    for (int i = 0; i < teamsList.size(); i++) {
                        String teamName = teamsList.get(i);
                        Team team = getTeamByName(teamName);
                        if (team != null) {
                            boolean isBest = legacyThirds.contains(teamName);
                            groupPredictionRepository.save(GroupPrediction.builder()
                                    .bet(bet)
                                    .groupName(groupName)
                                    .team(team)
                                    .position(i + 1)
                                    .isBestThird(isBest)
                                    .build());
                        }
                    }
                }
            }

            // 3. Parse Bracket (pronosticos_cuadro)
            saveBracketPhase(bet, dto.getR16(), "R16", dto.getFlatQf());
            saveBracketPhase(bet, dto.getQf(), "QF", dto.getFlatSf());
            saveBracketPhase(bet, dto.getSf(), "SF", dto.getFinalMatch());
            
            if (dto.getFinalMatch() != null && dto.getFinalMatch().size() == 2) {
                saveBracketSingleMatch(bet, dto.getFinalMatch(), "FINAL", dto.getChampion());
            }
            if (dto.getThirdPlaceMatch() != null && dto.getThirdPlaceMatch().size() == 2) {
                saveBracketSingleMatch(bet, dto.getThirdPlaceMatch(), "THIRD_PLACE", dto.getThirdPlaceWinner());
            }

            // 4. Parse Extra (pronosticos_extra)
            Team championTeam = getTeamByName(dto.getChampion());
            Team thirdPlaceTeam = getTeamByName(dto.getThirdPlaceWinner());

            if (championTeam != null) {
                extraPredictionRepository.save(ExtraPrediction.builder()
                        .bet(bet)
                        .topScorer(dto.getScorer())
                        .championTeam(championTeam)
                        .thirdPlaceTeam(thirdPlaceTeam)
                        .build());
            }

        } catch (Exception e) {
            log.error("Error al guardar predicciones para bet_id=" + bet.getId(), e);
        }
    }

    private void cleanOldPredictions(Long betId) {
        // Find and delete existing predictions for double-write updates
        // To be safe, we just let Cascade Delete handle it or delete manually
        groupPredictionRepository.deleteAll(groupPredictionRepository.findByBetId(betId));
        bracketPredictionRepository.deleteAll(bracketPredictionRepository.findByBetId(betId));
        extraPredictionRepository.findById(betId).ifPresent(extraPredictionRepository::delete);
    }

    private void saveBracketPhase(Bet bet, List<List<String>> phaseArray, String dbPhaseName, List<String> nextPhaseWinners) {
        if (phaseArray == null) return;

        for (int i = 0; i < phaseArray.size(); i++) {
            List<String> match = phaseArray.get(i);
            if (match.size() >= 2) {
                String homeName = match.get(0);
                String awayName = match.get(1);
                Team home = getTeamByName(homeName);
                Team away = getTeamByName(awayName);

                // Find winner by checking if home or away is present in the NEXT phase array
                String winnerName = findWinnerInNextPhaseList(homeName, awayName, nextPhaseWinners);
                Team winner = getTeamByName(winnerName);

                if (winner != null) {
                    bracketPredictionRepository.save(BracketPrediction.builder()
                            .bet(bet)
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

    private void saveBracketSingleMatch(Bet bet, List<String> match, String dbPhaseName, String winnerName) {
        if (match == null || match.size() < 2) return;

        String homeName = match.get(0);
        String awayName = match.get(1);

        Team home = getTeamByName(homeName);
        Team away = getTeamByName(awayName);
        Team winner = getTeamByName(winnerName);

        if (winner != null) {
            bracketPredictionRepository.save(BracketPrediction.builder()
                    .bet(bet)
                    .phase(dbPhaseName)
                    .matchIndex(0)
                    .homeTeam(home)
                    .awayTeam(away)
                    .winnerTeam(winner)
                    .build());
        }
    }

    private String findWinnerInNextPhaseList(String team1, String team2, List<String> nextPhaseWinners) {
        if (nextPhaseWinners == null) return team1; // fallback
        
        for (String t : nextPhaseWinners) {
            if (team1.equals(t)) return team1;
            if (team2.equals(t)) return team2;
        }
        
        return team1; // fallback
    }

    private Team getTeamByName(String name) {
        if (name == null) return null;
        return teamRepository.findByName(name).orElseGet(() -> 
            teamRepository.findByNameEn(name).orElse(null)
        );
    }

    @Transactional(readOnly = true)
    public BetDataDTO rebuildBetDataDtoFromTables(Long betId) {
        BetDataDTO dto = new BetDataDTO();

        // 1. Rebuild Groups
        List<GroupPrediction> groupPreds = groupPredictionRepository.findByBetId(betId);
        Map<String, List<String>> groupsMap = new LinkedHashMap<>();
        for (GroupPrediction gp : groupPreds) {
            groupsMap.putIfAbsent(gp.getGroupName(), new ArrayList<>());
        }
        
        // Sort by position before adding to the list
        groupPreds.sort(Comparator.comparingInt(GroupPrediction::getPosition));
        for (GroupPrediction gp : groupPreds) {
            if (gp.getTeam() != null) {
                groupsMap.get(gp.getGroupName()).add(gp.getTeam().getName());
            }
        }
        dto.setGroups(groupsMap);

        // Thirds (the 3rd placed teams that advanced)
        List<String> thirds = new ArrayList<>();
        for (GroupPrediction gp : groupPreds) {
            if (Boolean.TRUE.equals(gp.getIsBestThird()) && gp.getTeam() != null) {
                thirds.add(gp.getTeam().getName());
            }
        }
        dto.setThirds(thirds);

        // 2. Rebuild Bracket
        List<BracketPrediction> bracketPreds = bracketPredictionRepository.findByBetId(betId);
        
        // Knockout Phase Rebuild
        List<List<String>> r32 = buildPhaseArray(bracketPreds, "R32");
        if (r32.isEmpty()) {
            r32 = reconstructR32(dto.getGroups(), dto.getThirds());
        }
        dto.setR32(r32);

        dto.setR16(buildPhaseArray(bracketPreds, "R16"));
        dto.setQf(buildPhaseArray(bracketPreds, "QF"));
        dto.setSf(buildPhaseArray(bracketPreds, "SF"));

        // Final and Third Place
        BracketPrediction finalMatch = bracketPreds.stream().filter(p -> "FINAL".equals(p.getPhase())).findFirst().orElse(null);
        if (finalMatch != null && finalMatch.getHomeTeam() != null && finalMatch.getAwayTeam() != null) {
            dto.setFinalMatch(Arrays.asList(finalMatch.getHomeTeam().getName(), finalMatch.getAwayTeam().getName()));
        }

        BracketPrediction thirdPlace = bracketPreds.stream().filter(p -> "THIRD_PLACE".equals(p.getPhase())).findFirst().orElse(null);
        if (thirdPlace != null && thirdPlace.getHomeTeam() != null && thirdPlace.getAwayTeam() != null) {
            dto.setThirdPlaceMatch(Arrays.asList(thirdPlace.getHomeTeam().getName(), thirdPlace.getAwayTeam().getName()));
        }

        // 3. Rebuild Extra
        ExtraPrediction extra = extraPredictionRepository.findById(betId).orElse(null);
        if (extra != null) {
            dto.setScorer(extra.getTopScorer());
            if (extra.getChampionTeam() != null) {
                dto.setChampion(extra.getChampionTeam().getName());
            }
            if (extra.getThirdPlaceTeam() != null) {
                dto.setThirdPlaceWinner(extra.getThirdPlaceTeam().getName());
            }
        }

        return dto;
    }

    private List<List<String>> buildPhaseArray(List<BracketPrediction> allPreds, String phaseName) {
        List<BracketPrediction> phasePreds = allPreds.stream()
                .filter(p -> phaseName.equals(p.getPhase()))
                .sorted(Comparator.comparingInt(BracketPrediction::getMatchIndex))
                .collect(Collectors.toList());

        List<List<String>> result = new ArrayList<>();
        for (BracketPrediction p : phasePreds) {
            String home = p.getHomeTeam() != null ? p.getHomeTeam().getName() : null;
            String away = p.getAwayTeam() != null ? p.getAwayTeam().getName() : null;
            if (home != null && away != null) {
                result.add(Arrays.asList(home, away));
            }
        }
        return result;
    }

    private List<List<String>> reconstructR32(Map<String, List<String>> groups, List<String> thirds) {
        List<List<String>> r32 = new ArrayList<>();
        if (groups == null || groups.isEmpty()) return r32;

        for (int i = 0; i < 16; i++) {
            r32.add(Arrays.asList(null, null));
        }
        
        java.util.function.BiFunction<String, Integer, String> getTeam = (g, pos) -> {
            List<String> teams = groups.get(g);
            if (teams != null && teams.size() > pos) return teams.get(pos);
            return null;
        };

        // Left side
        r32.set(0, Arrays.asList(getTeam.apply("E", 0), null));
        r32.set(1, Arrays.asList(getTeam.apply("I", 0), null));
        r32.set(2, Arrays.asList(getTeam.apply("A", 1), getTeam.apply("B", 1)));
        r32.set(3, Arrays.asList(getTeam.apply("F", 0), getTeam.apply("C", 1)));
        r32.set(4, Arrays.asList(getTeam.apply("K", 1), getTeam.apply("L", 1)));
        r32.set(5, Arrays.asList(getTeam.apply("H", 0), getTeam.apply("J", 1)));
        r32.set(6, Arrays.asList(getTeam.apply("D", 0), null));
        r32.set(7, Arrays.asList(getTeam.apply("G", 0), null));

        // Right side
        r32.set(8, Arrays.asList(getTeam.apply("C", 0), getTeam.apply("F", 1)));
        r32.set(9, Arrays.asList(getTeam.apply("E", 1), getTeam.apply("I", 1)));
        r32.set(10, Arrays.asList(getTeam.apply("A", 0), null));
        r32.set(11, Arrays.asList(getTeam.apply("L", 0), null));
        r32.set(12, Arrays.asList(getTeam.apply("J", 0), getTeam.apply("H", 1)));
        r32.set(13, Arrays.asList(getTeam.apply("D", 1), getTeam.apply("G", 1)));
        r32.set(14, Arrays.asList(getTeam.apply("B", 0), null));
        r32.set(15, Arrays.asList(getTeam.apply("K", 0), null));

        if (thirds != null && !thirds.isEmpty()) {
            Map<String, String> teamToGroup = new HashMap<>();
            for (Map.Entry<String, List<String>> entry : groups.entrySet()) {
                if (entry.getValue().size() > 2) {
                    teamToGroup.put(entry.getValue().get(2), entry.getKey());
                }
            }
            
            List<String> sortedThirds = new ArrayList<>(thirds);
            sortedThirds.sort((t1, t2) -> {
                String g1 = teamToGroup.get(t1);
                String g2 = teamToGroup.get(t2);
                if (g1 == null) return -1;
                if (g2 == null) return 1;
                return g1.compareTo(g2);
            });

            int[] thirdIndices = {0, 1, 6, 7, 10, 11, 14, 15};
            for (int i = 0; i < Math.min(sortedThirds.size(), thirdIndices.length); i++) {
                r32.get(thirdIndices[i]).set(1, sortedThirds.get(i));
            }
        }

        return r32;
    }
}
