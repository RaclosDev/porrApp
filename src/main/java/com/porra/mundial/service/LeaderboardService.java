package com.porra.mundial.service;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.Bet;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.repository.BetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LeaderboardService {

    private final BetRepository betRepository;
    private final StandingsService standingsService;
    private final TopScorerService topScorerService;
    private final HashTransitionService hashTransitionService;


    @Cacheable(value = "leaderboard", key = "#groupId")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<ParticipantScoreDTO> getLeaderboard(Long groupId) {
        List<Bet> allBets = betRepository.findAll();
        Bet adminBet = allBets.stream().filter(b -> b.getParticipantName().equalsIgnoreCase("Admin") || (b.getBetName() != null && b.getBetName().equals("official"))).findFirst().orElse(null);
        BetDataDTO officialData = adminBet != null ? hashTransitionService.rebuildBetDataDtoFromTables(adminBet.getId()) : null;

        List<Bet> groupBets = allBets.stream().filter(b -> groupId.equals(b.getGroupId())).collect(Collectors.toList());

        Map<String, Map<String, Map<String, Integer>>> officialPoints = standingsService.getOfficialPoints();
        List<GroupStanding> allStandings = standingsService.getAllStandings();

        List<ParticipantScoreDTO> leaderboard = new ArrayList<>();

        // Group ordered standings for easy lookup
        Map<String, List<String>> orderedTeamsPerGroup = new HashMap<>();
        Map<String, GroupStanding> bestThirds = new HashMap<>(); // To calculate best thirds

        for (GroupStanding gs : allStandings) {
            orderedTeamsPerGroup.computeIfAbsent(gs.getGroupName(), k -> new ArrayList<>()).add(gs.getTeam().getName());
        }

        // Sort all thirds to find best 8
        List<GroupStanding> allThirds = new ArrayList<>();
        for (String group : orderedTeamsPerGroup.keySet()) {
            List<String> teams = orderedTeamsPerGroup.get(group);
            if (teams.size() >= 3) {
                String thirdPlaceName = teams.get(2);
                allStandings.stream().filter(gs -> gs.getTeam().getName().equals(thirdPlaceName)).findFirst().ifPresent(allThirds::add);
            }
        }
        
        // Sort best thirds (points, diff, goals)
        allThirds.sort((a, b) -> {
            if (a.getPoints() != b.getPoints()) return Integer.compare(b.getPoints(), a.getPoints());
            if (a.getGoalDiff() != b.getGoalDiff()) return Integer.compare(b.getGoalDiff(), a.getGoalDiff());
            return Integer.compare(b.getGoalsFor(), a.getGoalsFor());
        });
        
        List<String> bestVirtualThirds = allThirds.stream().limit(8).map(gs -> gs.getTeam().getName()).collect(Collectors.toList());
        List<Map<String, Object>> allScorers = topScorerService.getTopScorers();

        for (Bet bet : groupBets) {
            if (bet.getParticipantName().equalsIgnoreCase("Admin")) continue;
            BetDataDTO participant = hashTransitionService.rebuildBetDataDtoFromTables(bet.getId());
            if (participant == null) continue;

            ParticipantScoreDTO score = calculatePoints(participant, officialData, officialPoints, orderedTeamsPerGroup, bestVirtualThirds, allScorers);

            score.setId(bet.getId());
            score.setUserId(bet.getUser() != null ? bet.getUser().getId() : null);
            score.setName(bet.getParticipantName());
            score.setBetName(bet.getBetName());
            score.setThirdPlaceMatch(participant.getThirdPlaceMatch());
            score.setThirdPlaceWinner(participant.getThirdPlaceWinner());
            score.setPending(!Boolean.TRUE.equals(bet.getPaid()));
            leaderboard.add(score);
        }

        leaderboard.sort((a, b) -> Integer.compare(b.getTotal(), a.getTotal()));
        return leaderboard;
    }

    private ParticipantScoreDTO calculatePoints(BetDataDTO part, BetDataDTO off, Map<String, Map<String, Map<String, Integer>>> officialPoints, Map<String, List<String>> orderedTeamsPerGroup, List<String> bestVirtualThirds, List<Map<String, Object>> allScorers) {
        ParticipantScoreDTO score = ParticipantScoreDTO.builder()
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).total(0)
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();

        if (part.getGroups() != null) {
            for (String g : part.getGroups().keySet()) {
                List<String> pTeams = part.getGroups().get(g);
                String p1 = pTeams.size() > 0 ? pTeams.get(0) : null;
                String p2 = pTeams.size() > 1 ? pTeams.get(1) : null;
                String p3 = pTeams.size() > 2 ? pTeams.get(2) : null;

                List<String> oTeams = (off != null && off.getGroups() != null) ? off.getGroups().get(g) : null;
                String o1 = (oTeams != null && oTeams.size() > 0) ? oTeams.get(0) : null;
                String o2 = (oTeams != null && oTeams.size() > 1) ? oTeams.get(1) : null;
                String o3 = (oTeams != null && oTeams.size() > 2) ? oTeams.get(2) : null;

                List<String> vTeams = orderedTeamsPerGroup.get(g);
                String v1 = (vTeams != null && vTeams.size() > 0) ? vTeams.get(0) : null;
                String v2 = (vTeams != null && vTeams.size() > 1) ? vTeams.get(1) : null;
                String v3 = (vTeams != null && vTeams.size() > 2) ? vTeams.get(2) : null;

                String actualO1 = (o1 != null && !o1.contains("º")) ? o1 : v1;
                String actualO2 = (o2 != null && !o2.contains("º")) ? o2 : v2;
                String actualO3 = (o3 != null && !o3.contains("º")) ? o3 : v3;

                // Function to check if played
                boolean p1Played = hasPlayed(p1, officialPoints, g);
                boolean p2Played = hasPlayed(p2, officialPoints, g);
                boolean p3Played = hasPlayed(p3, officialPoints, g);

                boolean p1Passed = isPassed(p1, actualO1, actualO2, off, bestVirtualThirds, p1Played);
                boolean p2Passed = isPassed(p2, actualO1, actualO2, off, bestVirtualThirds, p2Played);
                
                boolean p3Selected = part.getThirds() != null && part.getThirds().contains(p3);
                boolean p3ActuallyPassed = isPassed(p3, actualO1, actualO2, off, bestVirtualThirds, p3Played);
                boolean p3Passed = p3Selected && p3ActuallyPassed;

                boolean p1Exact = actualO1 != null && actualO1.equals(p1);
                boolean p2Exact = actualO2 != null && actualO2.equals(p2);
                boolean p3Exact = actualO3 != null && actualO3.equals(p3) && p3Selected && p3ActuallyPassed;

                awardGroupPoints(score, p1, g, "1º", p1Passed, p1Exact);
                awardGroupPoints(score, p2, g, "2º", p2Passed, p2Exact);
                awardGroupPoints(score, p3, g, "Mejor 3º", p3Passed, p3Exact);

                Map<String, Object> exact = new HashMap<>();
                exact.put("1", p1Exact);
                exact.put("2", p2Exact);
                exact.put("3", p3Exact);
                score.getExactMatches().put(g, exact);

                score.getPassedTeams().put(p1, p1Passed);
                score.getPassedTeams().put(p2, p2Passed);
                score.getPassedTeams().put(p3, p3Passed);
            }
        }

        if (off != null) {
            checkRound(score, part.getFlatR16(), off.getFlatR16(), 25, "r32", "1/16: %s clasificado a octavos");
            checkRound(score, part.getFlatQf(), off.getFlatQf(), 30, "r16", "Octavos: %s clasificado a cuartos");
            checkRound(score, part.getFlatSf(), off.getFlatSf(), 40, "qf", "Cuartos: %s clasificado a semis");
            checkRound(score, part.getFinalMatch(), off.getFinalMatch(), 60, "sf", "Semis: %s clasificado a la final");

            if (part.getChampion() != null && part.getChampion().equals(off.getChampion())) award(score, 200, "finals", "Final: " + part.getChampion() + " Campeón");
            
            String off2nd = getSecond(off.getFinalMatch(), off.getChampion());
            String part2nd = getSecond(part.getFinalMatch(), part.getChampion());
            if (part2nd != null && part2nd.equals(off2nd)) award(score, 150, "finals", "Final: " + part2nd + " Subcampeón");

            if (part.getThirdPlaceWinner() != null && part.getThirdPlaceWinner().equals(off.getThirdPlaceWinner())) award(score, 100, "finals", "Tercer y Cuarto: " + part.getThirdPlaceWinner() + " Tercer puesto");
            
            String off4th = getSecond(off.getThirdPlaceMatch(), off.getThirdPlaceWinner());
            String part4th = getSecond(part.getThirdPlaceMatch(), part.getThirdPlaceWinner());
            if (part4th != null && part4th.equals(off4th)) award(score, 75, "finals", "Tercer y Cuarto: " + part4th + " Cuarto puesto");

            if (part.getScorer() != null && !part.getScorer().trim().isEmpty()) {
                boolean scorerAwarded = false;
                
                // First try to use the automated API data
                if (allScorers != null && !allScorers.isEmpty()) {
                    int maxGoals = (int) allScorers.get(0).get("goals");
                    if (maxGoals > 0) {
                        List<Map<String, Object>> topScorers = allScorers.stream()
                                .filter(s -> (int) s.get("goals") == maxGoals)
                                .collect(Collectors.toList());
                        
                        long validScorersCount = topScorers.size();
                        if (validScorersCount > 0) {
                            int points = (int) (100 / validScorersCount);
                            boolean isMatch = topScorers.stream()
                                    .anyMatch(s -> isScorerMatch(part.getScorer(), (String) s.get("name"), (String) s.get("shortName")));
                            
                            if (isMatch) {
                                String msg = validScorersCount > 1 
                                        ? "Pichichi: " + part.getScorer() + " acertado (" + points + " pts repartidos)"
                                        : "Pichichi: " + part.getScorer() + " acertado";
                                award(score, points, "scorer", msg);
                            }
                            scorerAwarded = true; // We processed it using API
                        }
                    }
                }
                
                // Fallback to manual entry if API didn't process it or wasn't available
                if (!scorerAwarded && off.getScorer() != null && !off.getScorer().trim().isEmpty()) {
                    String[] officialScorers = off.getScorer().split(",");
                    long validScorersCount = Arrays.stream(officialScorers)
                            .map(String::trim)
                            .filter(s -> !s.isEmpty())
                            .count();
                    
                    if (validScorersCount > 0) {
                        int points = (int) (100 / validScorersCount);
                        boolean isMatch = Arrays.stream(officialScorers)
                                .map(String::trim)
                                .filter(s -> !s.isEmpty())
                                .anyMatch(s -> isScorerMatch(part.getScorer(), s, s));
                        
                        if (isMatch) {
                            String msg = validScorersCount > 1 
                                    ? "Pichichi: " + part.getScorer() + " acertado (" + points + " pts repartidos)"
                                    : "Pichichi: " + part.getScorer() + " acertado";
                            award(score, points, "scorer", msg);
                        }
                    }
                }
            }
        }

        score.setTotal(score.getR1() + score.getR32() + score.getR16() + score.getQf() + score.getSf() + score.getFinals() + score.getScorer());
        return score;
    }

    private void checkRound(ParticipantScoreDTO score, List<String> pTeams, List<String> oTeams, int pts, String stage, String msgTemplate) {
        if (pTeams == null || oTeams == null) return;
        List<String> flatO = oTeams.stream().filter(Objects::nonNull).collect(Collectors.toList());
        for (String t : pTeams) {
            if (t != null && flatO.contains(t)) {
                award(score, pts, stage, String.format(msgTemplate, t));
            }
        }
    }

    private String getSecond(List<String> match, String winner) {
        if (match == null || winner == null) return null;
        return match.stream().filter(t -> t != null && !t.equals(winner)).findFirst().orElse(null);
    }

    private void awardGroupPoints(ParticipantScoreDTO score, String team, String group, String posDesc, boolean passed, boolean exact) {
        if (passed && exact) {
            award(score, 20, "r1", "Grupo " + group + ": " + team + " clasificado en posición exacta (" + posDesc + ")");
        } else {
            if (passed) award(score, 10, "r1", "Grupo " + group + ": " + team + " clasificado a la siguiente fase");
            if (exact) award(score, 10, "r1", "Grupo " + group + ": " + team + " acierto posición exacta (" + posDesc + ")");
        }
    }

    private void award(ParticipantScoreDTO score, int amount, String stage, String msg) {
        switch (stage) {
            case "r1": score.setR1(score.getR1() + amount); break;
            case "r32": score.setR32(score.getR32() + amount); break;
            case "r16": score.setR16(score.getR16() + amount); break;
            case "qf": score.setQf(score.getQf() + amount); break;
            case "sf": score.setSf(score.getSf() + amount); break;
            case "finals": score.setFinals(score.getFinals() + amount); break;
            case "scorer": score.setScorer(score.getScorer() + amount); break;
        }
        score.getLog().add(ParticipantScoreDTO.LogEntry.builder().stage(stage).amount(amount).msg(msg).build());
    }

    private boolean isPassed(String team, String actualO1, String actualO2, BetDataDTO off, List<String> bestVirtualThirds, boolean hasPlayed) {
        if (team == null) return false;
        if (actualO1 != null && actualO1.equals(team)) return true;
        if (actualO2 != null && actualO2.equals(team)) return true;
        if (off != null && off.getThirds() != null && off.getThirds().contains(team)) return true;
        if (bestVirtualThirds.contains(team)) return true;
        
        // Also check if officially in R32 (not strictly needed if actualO1/2 logic holds)
        if (off != null && off.getGroups() != null) {
            for (List<String> gTeams : off.getGroups().values()) {
                if (gTeams.size() > 0 && team.equals(gTeams.get(0))) return true;
                if (gTeams.size() > 1 && team.equals(gTeams.get(1))) return true;
            }
        }
        return false;
    }

    private boolean hasPlayed(String team, Map<String, Map<String, Map<String, Integer>>> officialPoints, String group) {
        if (team == null) return false;
        String safeName = team.replaceAll("[.#$\\[\\]]", "");
        if (officialPoints.containsKey(group) && officialPoints.get(group).containsKey(safeName)) {
            return officialPoints.get(group).get(safeName).getOrDefault("mp", 0) > 0;
        }
        return false;
    }

    private String normalizeStr(String input) {
        if (input == null) return "";
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "").toLowerCase().trim();
    }

    private boolean isScorerMatch(String userScorer, String apiName, String apiShortName) {
        if (userScorer == null || userScorer.trim().isEmpty()) return false;
        String user = normalizeStr(userScorer);
        String name = normalizeStr(apiName);
        String shortName = normalizeStr(apiShortName);
        
        if (name.equals(user) || shortName.equals(user)) return true;
        if (name.contains(user) || user.contains(name)) return true;
        if (shortName.contains(" ")) {
            String lastName = shortName.substring(shortName.lastIndexOf(" ") + 1);
            if (user.contains(lastName) || lastName.contains(user)) return true;
        }
        return false;
    }
}
