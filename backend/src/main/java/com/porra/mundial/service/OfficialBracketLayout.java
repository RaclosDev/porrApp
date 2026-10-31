package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.WorldCupBracketTopology;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Places provider matches on FIFA branches without treating kickoff order as bracket order. */
final class OfficialBracketLayout {
    private OfficialBracketLayout() {}

    static List<List<String>> firstRound(Map<String, List<String>> groups, List<Match> matches) {
        List<List<String>> result = new ArrayList<>();
        for (var slots : WorldCupBracketTopology.ROUND_OF_32) {
            result.add(pair(matches, Arrays.asList(qualifier(groups, slots.get(0))),
                    Arrays.asList(qualifier(groups, slots.get(1)))));
        }
        return result;
    }

    static List<List<String>> nextRound(List<List<String>> previous, List<Match> matches) {
        List<List<String>> result = new ArrayList<>();
        for (int i = 0; i + 1 < previous.size(); i += 2) {
            result.add(pair(matches, previous.get(i), previous.get(i + 1)));
        }
        return result;
    }

    static Match findMatch(List<Match> matches, List<String> pair) {
        if (pair == null || pair.stream().allMatch(Objects::isNull)) return null;
        return matches.stream().filter(match -> {
            var participants = Arrays.asList(name(match.getHomeTeam()), name(match.getAwayTeam()));
            return pair.stream().filter(Objects::nonNull).allMatch(participants::contains);
        }).findFirst().orElse(null);
    }

    static List<String> semifinalOutcomes(List<List<String>> semis, List<Match> matches, boolean winners) {
        return semis.stream().map(pair -> findMatch(matches, pair))
                .map(match -> winners ? KnockoutBracketService.winnerOf(match) : KnockoutBracketService.loserOf(match))
                .map(OfficialBracketLayout::name).toList();
    }

    private static List<String> pair(List<Match> matches, List<String> left, List<String> right) {
        for (Match match : matches) {
            String home = name(match.getHomeTeam());
            String away = name(match.getAwayTeam());
            if (anchored(home, away, left, right)) return Arrays.asList(home, away);
            if (anchored(away, home, left, right)) return Arrays.asList(away, home);
        }
        return Arrays.asList(null, null);
    }

    private static boolean anchored(String home, String away, List<String> left, List<String> right) {
        boolean knownLeft = home != null && left.contains(home);
        boolean knownRight = away != null && right.contains(away);
        return (knownLeft || knownRight)
                && (knownLeft || home == null || left.contains(null))
                && (knownRight || away == null || right.contains(null));
    }

    private static String qualifier(Map<String, List<String>> groups, String slot) {
        if (slot.startsWith("3")) return null;
        List<String> group = groups.get(slot.substring(1));
        int index = slot.charAt(0) - '1';
        return group != null && group.size() > index ? group.get(index) : null;
    }

    static String name(Team team) {
        return Team.isPlaceholder(team) ? null : team.getName();
    }
}
