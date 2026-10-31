package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.stream.Collectors;

/** Validates saved drafts without assuming a particular ordering of knockout pairings. */
@Component
@RequiredArgsConstructor
public class BracketPredictionValidator {
    private final TeamRepository teams;

    public void validate(Edition edition, PredictionDataDTO data) {
        if (edition == null || edition.getCompetition() == null
                || !Competition.WORLD_CUP_EXTERNAL_ID.equals(edition.getCompetition().getExternalId())
                || (edition.getPoolFormat() != PoolFormat.FULL_BRACKET
                    && edition.getPoolFormat() != PoolFormat.KNOCKOUTS_ONLY)) {
            throw invalid("Esta edición no admite predicciones de cuadro del Mundial");
        }
        if (data == null) throw invalid("Falta el cuadro");
        Map<String, Set<String>> catalog = teams.findAllByOrderByGroupNameAscNameAsc().stream()
                .filter(t -> t.getGroupName() != null && t.getGroupName().matches("[A-L]") && !Team.isPlaceholder(t))
                .collect(Collectors.groupingBy(Team::getGroupName, Collectors.mapping(Team::getName, Collectors.toSet())));
        Set<String> allowed = catalog.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
        Map<String, List<String>> groups = data.getGroups() == null ? Map.of() : data.getGroups();
        Set<String> qualifiers = new HashSet<>();
        Set<String> thirdCandidates = new HashSet<>();
        if (edition.getPoolFormat() == PoolFormat.KNOCKOUTS_ONLY) {
            if (!groups.isEmpty() || (data.getThirds() != null && !data.getThirds().isEmpty()))
                throw invalid("La modalidad de eliminatorias no admite fase de grupos");
        } else {
            if (groups.size() > 12 || !catalog.keySet().containsAll(groups.keySet()))
                throw invalid("La fase de grupos contiene un grupo desconocido");
            for (var entry : groups.entrySet()) {
                List<String> selected = entry.getValue();
                if (selected == null || selected.size() < 2 || selected.size() > 4 || selected.stream().anyMatch(Objects::isNull))
                    throw invalid("Cada grupo necesita entre dos y cuatro equipos");
                checked(selected, 4, catalog.get(entry.getKey()), "grupo " + entry.getKey());
                qualifiers.addAll(selected.subList(0, 2));
                if (selected.size() > 2) thirdCandidates.add(selected.get(2));
            }
            qualifiers.addAll(checked(data.getThirds(), 8, thirdCandidates, "mejores terceros"));
        }
        Set<String> r32 = round(data.getR32(), 16, allowed, "dieciseisavos");
        if (edition.getPoolFormat() == PoolFormat.FULL_BRACKET && !qualifiers.containsAll(r32))
            throw invalid("Los dieciseisavos deben proceder de los clasificados de grupos");
        Set<String> r16 = round(data.getR16(), 8, r32, "octavos");
        Set<String> qf = round(data.getQf(), 4, r16, "cuartos");
        Set<String> sf = round(data.getSf(), 2, qf, "semifinales");
        Set<String> finalists = checked(data.getFinalMatch(), 2, sf, "final");
        checked(data.getChampion() == null ? null : List.of(data.getChampion()), 1, finalists, "campeón");
        Set<String> losers = new HashSet<>(sf);
        losers.removeAll(finalists);
        Set<String> third = checked(data.getThirdPlaceMatch(), 2, losers, "tercer puesto");
        checked(data.getThirdPlaceWinner() == null ? null : List.of(data.getThirdPlaceWinner()), 1, third, "tercer clasificado");
    }

    private Set<String> round(List<List<String>> pairs, int maximum, Set<String> previous, String label) {
        if (pairs == null) return Set.of();
        if (pairs.size() > maximum) throw invalid("Demasiados partidos en " + label);
        List<String> names = new ArrayList<>();
        for (List<String> pair : pairs) {
            if (pair == null || pair.size() != 2) throw invalid("Cruce inválido en " + label);
            names.addAll(pair);
        }
        return checked(names, maximum * 2, previous, label);
    }

    private Set<String> checked(List<String> names, int maximum, Set<String> allowed, String label) {
        if (names == null) return Set.of();
        if (names.size() > maximum) throw invalid("Demasiados equipos en " + label);
        Set<String> unique = new HashSet<>();
        for (String name : names) {
            // Null slots represent an unfinished authenticated draft.
            if (name == null) continue;
            if (!allowed.contains(name) || !unique.add(name))
                throw invalid("Equipo inválido, repetido o sin clasificar en " + label);
        }
        return unique;
    }

    private IllegalArgumentException invalid(String reason) {
        return new IllegalArgumentException(reason);
    }
}
