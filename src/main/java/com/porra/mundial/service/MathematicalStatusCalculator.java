package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;

import java.util.*;
import java.util.stream.Collectors;

public class MathematicalStatusCalculator {

    enum Outcome { HOME_WIN, DRAW, AWAY_WIN }

    public static Map<Long, Integer> calculateStatus(List<GroupStanding> standings, List<Match> matches) {
        Map<Long, Integer> statusMap = new HashMap<>();
        if (standings.size() < 2) {
            for (GroupStanding gs : standings) statusMap.put(gs.getTeam().getId(), 0);
            return statusMap;
        }

        List<Match> unplayed = matches.stream()
                .filter(m -> m.getFinished() == null || !m.getFinished() || m.getHomeScore() == null)
                .collect(Collectors.toList());

        List<Match> played = matches.stream()
                .filter(m -> Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null)
                .collect(Collectors.toList());

        // If too many unplayed matches, return 0 (to avoid exponential explosion)
        if (unplayed.size() > 6) {
            for (GroupStanding gs : standings) statusMap.put(gs.getTeam().getId(), 0);
            return statusMap;
        }

        Map<Long, Integer> bestRanks = new HashMap<>();
        Map<Long, Integer> worstRanks = new HashMap<>();
        for (GroupStanding gs : standings) {
            bestRanks.put(gs.getTeam().getId(), 4);
            worstRanks.put(gs.getTeam().getId(), 1);
        }

        int combinations = (int) Math.pow(3, unplayed.size());

        for (int i = 0; i < combinations; i++) {
            List<Outcome> outcomes = decodeOutcomes(i, unplayed.size());
            simulatePermutation(standings, played, unplayed, outcomes, bestRanks, worstRanks);
        }

        for (GroupStanding gs : standings) {
            Long tid = gs.getTeam().getId();
            int best = bestRanks.get(tid);
            int worst = worstRanks.get(tid);

            int status = 0;
            if (best == worst) {
                status = best; // 1, 2, 3, or 4 (Fixed position)
            } else if (worst <= 2) {
                status = 5; // Guaranteed Top 2 (but could be 1st or 2nd)
            } else if (best >= 3) {
                status = -1; // Guaranteed Last/Eliminated (but could be 3rd or 4th)
            }
            
            statusMap.put(tid, status);
        }

        return statusMap;
    }

    private static List<Outcome> decodeOutcomes(int index, int size) {
        List<Outcome> outcomes = new ArrayList<>();
        int temp = index;
        for (int i = 0; i < size; i++) {
            int rem = temp % 3;
            if (rem == 0) outcomes.add(Outcome.HOME_WIN);
            else if (rem == 1) outcomes.add(Outcome.DRAW);
            else outcomes.add(Outcome.AWAY_WIN);
            temp /= 3;
        }
        return outcomes;
    }

    private static void simulatePermutation(List<GroupStanding> standings, List<Match> played, List<Match> unplayed, List<Outcome> outcomes, Map<Long, Integer> bestRanks, Map<Long, Integer> worstRanks) {
        Map<Long, Integer> simPts = new HashMap<>();
        Map<Long, Integer> simGd = new HashMap<>();
        Map<Long, Integer> simGf = new HashMap<>();
        
        for (GroupStanding gs : standings) {
            simPts.put(gs.getTeam().getId(), gs.getPoints() != null ? gs.getPoints() : 0);
            simGd.put(gs.getTeam().getId(), gs.getGoalDiff() != null ? gs.getGoalDiff() : 0);
            simGf.put(gs.getTeam().getId(), gs.getGoalsFor() != null ? gs.getGoalsFor() : 0);
        }

        // We already have current points from group standings? NO, the 'standings' argument already HAS the points from 'played' matches.
        // Wait, if GroupStanding already has points, adding played matches again will DOUBLE COUNT the points!
        // So we should ONLY add points from UNPLAYED matches to the existing GroupStanding points!
        // Let's reset the map to use the baseline points.
        for (GroupStanding gs : standings) {
            simPts.put(gs.getTeam().getId(), gs.getPoints() != null ? gs.getPoints() : 0);
        }

        // Apply unplayed match outcomes
        List<Match> allSimulatedMatches = new ArrayList<>(played);
        for (int i = 0; i < unplayed.size(); i++) {
            Match m = unplayed.get(i);
            Outcome out = outcomes.get(i);
            Long homeId = m.getHomeTeam().getId();
            Long awayId = m.getAwayTeam().getId();
            
            Match simMatch = new Match();
            simMatch.setHomeTeam(m.getHomeTeam());
            simMatch.setAwayTeam(m.getAwayTeam());
            
            if (simPts.containsKey(homeId) && simPts.containsKey(awayId)) {
                if (out == Outcome.HOME_WIN) {
                    simPts.put(homeId, simPts.get(homeId) + 3);
                    simGd.put(homeId, simGd.get(homeId) + 1);
                    simGf.put(homeId, simGf.get(homeId) + 1);
                    simGd.put(awayId, simGd.get(awayId) - 1);
                    simMatch.setHomeScore(1); simMatch.setAwayScore(0);
                } else if (out == Outcome.AWAY_WIN) {
                    simPts.put(awayId, simPts.get(awayId) + 3);
                    simGd.put(awayId, simGd.get(awayId) + 1);
                    simGf.put(awayId, simGf.get(awayId) + 1);
                    simGd.put(homeId, simGd.get(homeId) - 1);
                    simMatch.setHomeScore(0); simMatch.setAwayScore(1);
                } else {
                    simPts.put(homeId, simPts.get(homeId) + 1);
                    simPts.put(awayId, simPts.get(awayId) + 1);
                    simMatch.setHomeScore(0); simMatch.setAwayScore(0);
                }
            }
            allSimulatedMatches.add(simMatch);
        }

        // Rank teams
        Map<Long, Integer> curBest = new HashMap<>();
        Map<Long, Integer> curWorst = new HashMap<>();

        for (GroupStanding t1 : standings) {
            int strictlyBetter = 0;
            int tied = 0;
            Long id1 = t1.getTeam().getId();
            int pts1 = simPts.get(id1);

            for (GroupStanding t2 : standings) {
                Long id2 = t2.getTeam().getId();
                if (id1.equals(id2)) continue;
                
                int pts2 = simPts.get(id2);
                if (pts2 > pts1) {
                    strictlyBetter++;
                } else if (pts2 == pts1) {
                    // Tie breaker: Head-to-Head among all teams tied with pts1
                    List<Long> tiedGroupIds = new ArrayList<>();
                    for (GroupStanding gs : standings) {
                        if (simPts.get(gs.getTeam().getId()) == pts1) {
                            tiedGroupIds.add(gs.getTeam().getId());
                        }
                    }
                    
                    int[] h2h1 = calculateH2HStats(id1, tiedGroupIds, allSimulatedMatches);
                    int[] h2h2 = calculateH2HStats(id2, tiedGroupIds, allSimulatedMatches);
                    
                    if (h2h2[0] > h2h1[0]) strictlyBetter++;
                    else if (h2h2[0] == h2h1[0]) {
                        if (h2h2[1] > h2h1[1]) strictlyBetter++;
                        else if (h2h2[1] == h2h1[1]) {
                            if (h2h2[2] > h2h1[2]) strictlyBetter++;
                            else if (h2h2[2] == h2h1[2]) {
                                if (simGd.get(id2) > simGd.get(id1)) strictlyBetter++;
                                else if (simGd.get(id2).equals(simGd.get(id1))) {
                                    if (simGf.get(id2) > simGf.get(id1)) strictlyBetter++;
                                    else if (simGf.get(id2).equals(simGf.get(id1))) {
                                        tied++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            curBest.put(id1, 1 + strictlyBetter);
            curWorst.put(id1, 1 + strictlyBetter + tied);
        }

        for (GroupStanding gs : standings) {
            Long tid = gs.getTeam().getId();
            bestRanks.put(tid, Math.min(bestRanks.get(tid), curBest.get(tid)));
            worstRanks.put(tid, Math.max(worstRanks.get(tid), curWorst.get(tid)));
        }
    }

    private static int[] calculateH2HStats(Long teamId, List<Long> tiedGroup, List<Match> matches) {
        int pts = 0, gd = 0, gf = 0;
        for (Match m : matches) {
            if (m.getHomeTeam() != null && m.getAwayTeam() != null) {
                Long hId = m.getHomeTeam().getId();
                Long aId = m.getAwayTeam().getId();
                if (tiedGroup.contains(hId) && tiedGroup.contains(aId)) {
                    if (hId.equals(teamId)) {
                        if (m.getHomeScore() != null && m.getAwayScore() != null) {
                            gf += m.getHomeScore();
                            gd += (m.getHomeScore() - m.getAwayScore());
                            if (m.getHomeScore() > m.getAwayScore()) pts += 3;
                            else if (m.getHomeScore().equals(m.getAwayScore())) pts += 1;
                        }
                    } else if (aId.equals(teamId)) {
                        if (m.getHomeScore() != null && m.getAwayScore() != null) {
                            gf += m.getAwayScore();
                            gd += (m.getAwayScore() - m.getHomeScore());
                            if (m.getAwayScore() > m.getHomeScore()) pts += 3;
                            else if (m.getAwayScore().equals(m.getHomeScore())) pts += 1;
                        }
                    }
                }
            }
        }
        return new int[]{pts, gd, gf};
    }
}
