package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;

import java.util.*;
import java.util.stream.Collectors;

/**
 *  Calculadora de Estatus Matemático para la Fase de Grupos.
 * Esta clase NO es un @Service de Spring, es una utilidad estática.
 * 
 * ¿Qué hace?
 * Analiza un grupo y, calculando TODAS las combinaciones posibles de los partidos
 * que faltan por jugar (victoria local, empate, victoria visitante), determina si
 * un equipo está:
 *  - Matemáticamente Clasificado (status 1)
 *  - Matemáticamente Eliminado (status -1)
 *  - Todavía con vida / Posible (status 0)
 * 
 * Esencialmente es un algoritmo de fuerza bruta (permutaciones) que prueba todos
 * los futuros paralelos posibles.
 */
public class MathematicalStatusCalculator {

    public enum Outcome { HOME_WIN, DRAW, AWAY_WIN }

    /**
     * Calcula el estado de cada equipo en el grupo.
     * @param standings Clasificación actual.
     * @param matches Todos los partidos del grupo (jugados y no jugados).
     * @return Mapa con el ID del equipo y su estatus matemático.
     */
    public static Map<Long, Integer> calculateStatus(List<GroupStanding> standings, List<Match> matches) {
        Map<Long, Integer> statusMap = new HashMap<>();
        if (standings.size() < 2) {
            standings.forEach(gs -> statusMap.put(gs.getTeam().getId(), 0));
            return statusMap;
        }

        List<Match> unplayed = matches.stream()
                .filter(m -> m.getFinished() == null || !m.getFinished() || m.getHomeScore() == null)
                .collect(Collectors.toList());

        List<Match> played = matches.stream()
                .filter(m -> Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null)
                .collect(Collectors.toList());

        // Si faltan demasiados partidos (más de 6, por ejemplo), el cálculo es muy pesado.
        // Mejor decir que todo está abierto. (3^7 = 2187 permutaciones, 3^8 = 6561).
        if (unplayed.size() > 6) {
            standings.forEach(gs -> statusMap.put(gs.getTeam().getId(), 0));
            return statusMap;
        }

        // Rastrear la mejor y peor posición de cada equipo en todas las simulaciones.
        Map<Long, Integer> bestRanks = new HashMap<>();
        Map<Long, Integer> worstRanks = new HashMap<>();
        standings.forEach(gs -> {
            bestRanks.put(gs.getTeam().getId(), 4);
            worstRanks.put(gs.getTeam().getId(), 1);
        });

        // Número total de futuros posibles: 3 ^ (número de partidos restantes)
        int combinations = (int) Math.pow(3, unplayed.size());

        // Simular cada uno de esos futuros paralelos
        for (int i = 0; i < combinations; i++) {
            List<Outcome> outcomes = decodeOutcomes(i, unplayed.size());
            simulatePermutation(standings, played, unplayed, outcomes, bestRanks, worstRanks);
        }

        return resolveFinalStatus(standings, bestRanks, worstRanks);
    }

    /**
     * Una vez terminadas las simulaciones, decidimos el estatus en base
     * a su mejor o peor rango alcanzable.
     */
    private static Map<Long, Integer> resolveFinalStatus(List<GroupStanding> standings, Map<Long, Integer> bestRanks, Map<Long, Integer> worstRanks) {
        Map<Long, Integer> statusMap = new HashMap<>();
        for (GroupStanding gs : standings) {
            Long tid = gs.getTeam().getId();
            int best = bestRanks.get(tid);
            int worst = worstRanks.get(tid);

            int status = 0; // Abierto
            if (best == worst) status = best; // Aseguró exactamente un puesto (ej: 1º seguro)
            else if (worst <= 2) status = 5;  // 5 = Matemáticamente Clasificado (peor caso es 2º)
            else if (best >= 3) status = -1;  // -1 = Matemáticamente Eliminado (mejor caso es 3º)
            
            statusMap.put(tid, status);
        }
        return statusMap;
    }

    /**
     * Convierte un número entero (0 a 3^N) en un arreglo de resultados (Victoria, Empate, Derrota)
     * basándose en base 3.
     */
    private static List<Outcome> decodeOutcomes(int index, int size) {
        List<Outcome> outcomes = new ArrayList<>(size);
        int temp = index;
        for (int i = 0; i < size; i++) {
            int rem = temp % 3;
            outcomes.add(rem == 0 ? Outcome.HOME_WIN : (rem == 1 ? Outcome.DRAW : Outcome.AWAY_WIN));
            temp /= 3;
        }
        return outcomes;
    }

    /**
     * Ejecuta una simulación concreta sumando puntos y goles de forma temporal.
     */
    private static void simulatePermutation(List<GroupStanding> standings, List<Match> played, List<Match> unplayed, 
                                            List<Outcome> outcomes, Map<Long, Integer> bestRanks, Map<Long, Integer> worstRanks) {
        Map<Long, TeamSim> simStats = new HashMap<>();
        standings.forEach(gs -> simStats.put(gs.getTeam().getId(), new TeamSim(gs.getTeam().getId(), gs.getPoints() != null ? gs.getPoints() : 0, gs.getGoalDiff() != null ? gs.getGoalDiff() : 0, gs.getGoalsFor() != null ? gs.getGoalsFor() : 0)));

        List<Match> allMatches = new ArrayList<>(played);

        for (int i = 0; i < unplayed.size(); i++) {
            Match m = unplayed.get(i);
            Outcome out = outcomes.get(i);
            Long homeId = m.getHomeTeam().getId();
            Long awayId = m.getAwayTeam().getId();
            
            if (!simStats.containsKey(homeId) || !simStats.containsKey(awayId)) continue;
            
            TeamSim home = simStats.get(homeId);
            TeamSim away = simStats.get(awayId);
            
            Match simMatch = new Match();
            simMatch.setHomeTeam(m.getHomeTeam());
            simMatch.setAwayTeam(m.getAwayTeam());

            if (out == Outcome.HOME_WIN) {
                home.addWin(); away.addLoss();
                simMatch.setHomeScore(1); simMatch.setAwayScore(0);
            } else if (out == Outcome.AWAY_WIN) {
                away.addWin(); home.addLoss();
                simMatch.setHomeScore(0); simMatch.setAwayScore(1);
            } else {
                home.addDraw(); away.addDraw();
                simMatch.setHomeScore(0); simMatch.setAwayScore(0);
            }
            allMatches.add(simMatch);
        }

        rankTeams(simStats, allMatches, bestRanks, worstRanks);
    }

    /**
     * Ordena los equipos según la simulación actual y actualiza el best/worst rank general.
     */
    private static void rankTeams(Map<Long, TeamSim> simStats, List<Match> allMatches, Map<Long, Integer> bestRanks, Map<Long, Integer> worstRanks) {
        List<TeamSim> teams = new ArrayList<>(simStats.values());
        
        // Aplica reglas de desempate UEFA/FIFA
        teams.sort((t1, t2) -> {
            if (t1.pts != t2.pts) return Integer.compare(t2.pts, t1.pts);
            
            List<Long> tiedGroup = teams.stream().filter(t -> t.pts == t1.pts).map(t -> t.id).collect(Collectors.toList());
            int[] h2h1 = calculateH2HStats(t1.id, tiedGroup, allMatches);
            int[] h2h2 = calculateH2HStats(t2.id, tiedGroup, allMatches);
            
            if (h2h1[0] != h2h2[0]) return Integer.compare(h2h2[0], h2h1[0]);
            if (h2h1[1] != h2h2[1]) return Integer.compare(h2h2[1], h2h1[1]);
            if (h2h1[2] != h2h2[2]) return Integer.compare(h2h2[2], h2h1[2]);
            if (t1.gd != t2.gd) return Integer.compare(t2.gd, t1.gd);
            return Integer.compare(t2.gf, t1.gf);
        });

        int currentRank = 1;
        for (int i = 0; i < teams.size(); i++) {
            if (i > 0) {
                TeamSim prev = teams.get(i - 1);
                TeamSim curr = teams.get(i);
                if (compareTeams(prev, curr, teams, allMatches) != 0) {
                    currentRank = i + 1;
                }
            }
            Long tid = teams.get(i).id;
            bestRanks.put(tid, Math.min(bestRanks.get(tid), currentRank));
            
            int worstRank = currentRank;
            for (int j = i + 1; j < teams.size(); j++) {
                if (compareTeams(teams.get(i), teams.get(j), teams, allMatches) == 0) worstRank++;
                else break;
            }
            worstRanks.put(tid, Math.max(worstRanks.get(tid), worstRank));
        }
    }

    private static int compareTeams(TeamSim t1, TeamSim t2, List<TeamSim> allTeams, List<Match> allMatches) {
        if (t1.pts != t2.pts) return Integer.compare(t2.pts, t1.pts);
        List<Long> tiedGroup = allTeams.stream().filter(t -> t.pts == t1.pts).map(t -> t.id).collect(Collectors.toList());
        int[] h2h1 = calculateH2HStats(t1.id, tiedGroup, allMatches);
        int[] h2h2 = calculateH2HStats(t2.id, tiedGroup, allMatches);
        if (h2h1[0] != h2h2[0]) return Integer.compare(h2h2[0], h2h1[0]);
        if (h2h1[1] != h2h2[1]) return Integer.compare(h2h2[1], h2h1[1]);
        if (h2h1[2] != h2h2[2]) return Integer.compare(h2h2[2], h2h1[2]);
        if (t1.gd != t2.gd) return Integer.compare(t2.gd, t1.gd);
        return Integer.compare(t2.gf, t1.gf);
    }

    private static int[] calculateH2HStats(Long teamId, List<Long> tiedGroup, List<Match> matches) {
        int pts = 0, gd = 0, gf = 0;
        for (Match m : matches) {
            if (m.getHomeTeam() != null && m.getAwayTeam() != null) {
                Long hId = m.getHomeTeam().getId();
                Long aId = m.getAwayTeam().getId();
                if (tiedGroup.contains(hId) && tiedGroup.contains(aId)) {
                    Integer hs = m.getHomeScore();
                    Integer as = m.getAwayScore();
                    if (hs != null && as != null) {
                        if (hId.equals(teamId)) {
                            gf += hs; gd += (hs - as);
                            if (hs > as) pts += 3; else if (hs.equals(as)) pts += 1;
                        } else if (aId.equals(teamId)) {
                            gf += as; gd += (as - hs);
                            if (as > hs) pts += 3; else if (as.equals(hs)) pts += 1;
                        }
                    }
                }
            }
        }
        return new int[]{pts, gd, gf};
    }

    private static class TeamSim {
        Long id; int pts, gd, gf;
        public TeamSim(Long id, int pts, int gd, int gf) { this.id = id; this.pts = pts; this.gd = gd; this.gf = gf; }
        public void addWin() { pts += 3; gd += 1; gf += 1; }
        public void addLoss() { gd -= 1; }
        public void addDraw() { pts += 1; }
    }
}
