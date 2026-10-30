package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Estado matemático de cada equipo del grupo, probando todos los resultados pendientes (3^n; con
 * más de 6 pendientes no calcula). 0 abierto, 1-4 puesto asegurado, 5 entre los dos primeros, -1 eliminado.
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

        // Con 7 o más pendientes (3^7 = 2187 combinaciones) no se calcula: todo queda abierto.
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

        int combinations = (int) Math.pow(3, unplayed.size());
        // Las tarjetas de los partidos que faltan no se conocen: el fair play solo desempata con el grupo cerrado.
        boolean fairPlayKnown = unplayed.isEmpty();

        for (int i = 0; i < combinations; i++) {
            List<Outcome> outcomes = decodeOutcomes(i, unplayed.size());
            simulatePermutation(standings, played, unplayed, outcomes, fairPlayKnown, bestRanks, worstRanks);
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
            else if (worst <= 2) status = 5;  // 5 = Matemáticamente Clasificado directo (peor caso es 2º)
            else if (best >= 4) status = -1;  // -1 = Matemáticamente Eliminado (peor caso posible es 4º, sin repesca de mejores 3ºs)
            
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
     * Ejecuta una simulación concreta (victorias 1-0, empates 0-0), la ordena con los desempates del
     * reglamento y actualiza el mejor y el peor puesto de cada equipo. Los equipos que el reglamento no
     * separa en la simulación pueden acabar en cualquiera de los puestos que comparten.
     */
    private static void simulatePermutation(List<GroupStanding> standings, List<Match> played, List<Match> unplayed,
                                            List<Outcome> outcomes, boolean fairPlayKnown,
                                            Map<Long, Integer> bestRanks, Map<Long, Integer> worstRanks) {
        Map<Long, GroupStanding> simStats = new LinkedHashMap<>();
        for (GroupStanding gs : standings) {
            simStats.put(gs.getTeam().getId(), GroupStanding.builder()
                    .team(gs.getTeam())
                    .points(orZero(gs.getPoints()))
                    .goalDiff(orZero(gs.getGoalDiff()))
                    .goalsFor(orZero(gs.getGoalsFor()))
                    .fairPlayPoints(fairPlayKnown ? orZero(gs.getFairPlayPoints()) : 0)
                    .build());
        }

        List<Match> allMatches = new ArrayList<>(played);

        for (int i = 0; i < unplayed.size(); i++) {
            Match m = unplayed.get(i);
            Outcome out = outcomes.get(i);
            GroupStanding home = simStats.get(m.getHomeTeam().getId());
            GroupStanding away = simStats.get(m.getAwayTeam().getId());
            if (home == null || away == null) continue;

            int homeGoals = out == Outcome.HOME_WIN ? 1 : 0;
            int awayGoals = out == Outcome.AWAY_WIN ? 1 : 0;
            addResult(home, homeGoals, awayGoals);
            addResult(away, awayGoals, homeGoals);
            allMatches.add(Match.builder()
                    .homeTeam(m.getHomeTeam()).awayTeam(m.getAwayTeam())
                    .homeScore(homeGoals).awayScore(awayGoals)
                    .finished(true)
                    .build());
        }

        int position = 1;
        for (List<GroupStanding> tier : GroupTiebreaker.tiers(new ArrayList<>(simStats.values()), allMatches)) {
            int lastPosition = position + tier.size() - 1;
            for (GroupStanding gs : tier) {
                Long tid = gs.getTeam().getId();
                bestRanks.put(tid, Math.min(bestRanks.get(tid), position));
                worstRanks.put(tid, Math.max(worstRanks.get(tid), lastPosition));
            }
            position = lastPosition + 1;
        }
    }

    private static void addResult(GroupStanding gs, int scored, int conceded) {
        gs.setPoints(gs.getPoints() + (scored > conceded ? 3 : scored == conceded ? 1 : 0));
        gs.setGoalDiff(gs.getGoalDiff() + scored - conceded);
        gs.setGoalsFor(gs.getGoalsFor() + scored);
    }

    private static int orZero(Integer value) {
        return value != null ? value : 0;
    }
}
