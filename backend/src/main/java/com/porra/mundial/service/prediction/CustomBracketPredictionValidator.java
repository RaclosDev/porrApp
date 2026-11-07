package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class CustomBracketPredictionValidator {
    private final TeamRepository teams;
    private final MatchRepository matches;

    public void validate(Edition edition, PredictionDataDTO data) {
        Competition competition = edition.getCompetition();
        if (!PredictableBracket.applies(edition) || data == null) {
            throw invalid("Esta edición no admite ese cuadro");
        }
        if (DrawnKnockout.applies(edition)) {
            validateDrawn(edition, data);
            return;
        }
        List<Team> catalog = teams.findByCompetitionIdOrderByNameAsc(competition.getId());
        Map<String, Set<String>> byGroup = new HashMap<>();
        for (Team team : catalog) {
            if (team.getGroupName() != null) {
                byGroup.computeIfAbsent(team.getGroupName(), key -> new HashSet<>()).add(team.getName());
            }
        }
        Map<String, List<String>> selections = data.getGroups() == null ? Map.of() : data.getGroups();
        boolean custom = competition.getOwnerLeague() != null;
        if (custom && edition.getPoolFormat() == PoolFormat.FULL_BRACKET) {
            if (byGroup.isEmpty() || !selections.keySet().equals(byGroup.keySet())) {
                throw invalid("Faltan grupos por completar");
            }
            for (var entry : byGroup.entrySet()) {
                List<String> ordered = selections.get(entry.getKey());
                if (ordered == null || ordered.size() != entry.getValue().size()
                        || !new HashSet<>(ordered).equals(entry.getValue())) {
                    throw invalid("La clasificación del grupo " + entry.getKey() + " no es válida");
                }
            }
        } else if (!selections.isEmpty()) {
            throw invalid("Este cuadro no tiene fase de grupos");
        }

        List<List<Match>> bracket = PredictableBracket.rounds(competition, matches.findByCompetitionId(competition.getId()));
        List<Match> firstRound = bracket.isEmpty() ? List.of() : bracket.get(0);
        if (firstRound.isEmpty()) {
            throw invalid(custom ? "El administrador aún no ha configurado los cruces" : "Aún no hay cruces del cuadro");
        }
        Set<String> seen = new HashSet<>();
        List<String> entrants = new ArrayList<>();
        for (Match match : firstRound) {
            if (match.getHomeTeam() == null) throw invalid("Cruce sin equipo");
            String home = match.getHomeTeam().getName();
            if (!seen.add(home)) throw invalid("Equipo repetido en los cruces");
            entrants.add(home);
            if (match.getAwayTeam() != null) {
                String away = match.getAwayTeam().getName();
                if (!seen.add(away)) throw invalid("Equipo repetido en los cruces");
                entrants.add(away);
            }
        }
        if (entrants.size() < 2) throw invalid("El cuadro necesita al menos dos equipos");
        List<List<String>> rounds = data.getCustomRounds();
        if (rounds == null) throw invalid("Faltan las predicciones del cuadro");
        List<String> current = new ArrayList<>();
        for (Match match : firstRound) {
            current.add(match.getHomeTeam().getName());
            current.add(match.getAwayTeam() == null ? null : match.getAwayTeam().getName());
        }
        int index = 0;
        while (current.size() > 1) {
            if (index >= rounds.size()) throw invalid("Falta una ronda del cuadro");
            List<String> picks = rounds.get(index);
            int count = (current.size() + 1) / 2;
            if (picks == null || picks.size() != count) throw invalid("Ronda incompleta");
            List<String> next = new ArrayList<>();
            for (int pair = 0; pair < count; pair++) {
                String home = current.get(pair * 2);
                String away = pair * 2 + 1 < current.size() ? current.get(pair * 2 + 1) : null;
                String pick = picks.get(pair);
                if (pick == null || (!pick.equals(home) && !pick.equals(away))) {
                    throw invalid("Un ganador no pertenece a su cruce");
                }
                if (away == null && !pick.equals(home)) throw invalid("Descanso incorrecto");
                next.add(pick);
            }
            current = next;
            index++;
        }
        if (index != rounds.size() || !current.get(0).equals(data.getChampion())) {
            throw invalid("El campeón no coincide con el cuadro");
        }
    }

    /**
     * Eliminatorias sorteadas ronda a ronda: en cada ronda ya sorteada se elige quién pasa en los cruces
     * que se quiera (null deja uno sin elegir); las rondas sin sortear van vacías. El campeón es el
     * elegido en la final.
     */
    private void validateDrawn(Edition edition, PredictionDataDTO data) {
        if (data.getGroups() != null && !data.getGroups().isEmpty()) {
            throw invalid("Este cuadro no tiene fase de grupos");
        }
        List<DrawnKnockout.Round> rounds = DrawnKnockout.rounds(edition,
                matches.findByCompetitionId(edition.getCompetition().getId()));
        if (rounds.isEmpty()) throw invalid("Aún no se han sorteado los cruces");
        List<List<String>> picks = data.getCustomRounds();
        if (picks == null) throw invalid("Faltan las predicciones del cuadro");
        if (picks.size() > rounds.size()) throw invalid("El cuadro tiene más rondas que la competición");
        boolean any = false;
        String finalPick = null;
        for (int index = 0; index < picks.size(); index++) {
            List<String> row = picks.get(index);
            if (row == null || row.isEmpty()) continue;
            DrawnKnockout.Round round = rounds.get(index);
            if (!round.drawn()) {
                throw invalid("La ronda de " + DrawnKnockout.title(round.key()) + " aún no se ha sorteado");
            }
            if (row.size() != round.ties().size()) {
                throw invalid("Los cruces de " + DrawnKnockout.title(round.key()) + " han cambiado: vuelve a cargar");
            }
            for (int tie = 0; tie < row.size(); tie++) {
                String pick = row.get(tie);
                if (pick == null) continue;
                if (!round.ties().get(tie).has(pick)) throw invalid("Un equipo elegido no juega ese cruce");
                any = true;
            }
            if ("final".equals(round.key())) finalPick = row.get(0);
        }
        if (!any) throw invalid("Elige quién pasa en algún cruce");
        String champion = data.getChampion() == null || data.getChampion().isBlank() ? null : data.getChampion();
        if (!java.util.Objects.equals(champion, finalPick)) {
            throw invalid("El campeón no coincide con el elegido en la final");
        }
    }

    private BusinessException invalid(String reason) {
        return BusinessException.badRequest(reason);
    }
}
