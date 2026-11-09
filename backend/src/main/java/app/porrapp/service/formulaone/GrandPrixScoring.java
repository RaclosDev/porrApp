package app.porrapp.service.formulaone;

import app.porrapp.model.MatchPrediction;
import app.porrapp.model.RaceWeekend;
import app.porrapp.scoring.ScoringRuleSet;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Puntos de una predicción de Gran Premio:
 * <ul>
 *   <li>cada piloto del podio en su puesto exacto: {@code f1ExactPositionPoints};</li>
 *   <li>cada piloto que sube al podio pero en otro puesto: {@code f1PodiumPoints};</li>
 *   <li>la pole: {@code f1PolePoints}; la vuelta rápida: {@code f1FastestLapPoints}.</li>
 * </ul>
 * Una parte cuyo resultado ESPN no da (por ejemplo, la vuelta rápida) no suma ni resta.
 */
public final class GrandPrixScoring {

    private GrandPrixScoring() {}

    public record Result(int points, String details) {}

    private static final String[] PLACES = {"1.º", "2.º", "3.º"};

    /**
     * @param names nombre corto de cada piloto, para el desglose
     * @return null si el Gran Premio aún no tiene podio
     */
    public static Result score(MatchPrediction pick, RaceWeekend weekend, ScoringRuleSet rules, Map<Long, String> names) {
        if (pick == null || weekend == null || !weekend.hasPodium()) return null;
        List<Long> podium = List.of(weekend.getFirstDriverId(), weekend.getSecondDriverId(), weekend.getThirdDriverId());
        Long[] picked = {pick.getRaceFirstDriverId(), pick.getRaceSecondDriverId(), pick.getRaceThirdDriverId()};

        int points = 0;
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < picked.length; i++) {
            Long driver = picked[i];
            if (driver == null) continue;
            if (driver.equals(podium.get(i))) {
                points += rules.getF1ExactPositionPoints();
                parts.add(name(names, driver) + " " + PLACES[i] + " (+" + rules.getF1ExactPositionPoints() + ")");
            } else if (podium.contains(driver)) {
                points += rules.getF1PodiumPoints();
                parts.add(name(names, driver) + " en el podio (+" + rules.getF1PodiumPoints() + ")");
            }
        }
        if (pick.getRacePoleDriverId() != null && Objects.equals(pick.getRacePoleDriverId(), weekend.getPoleDriverId())) {
            points += rules.getF1PolePoints();
            parts.add("pole (+" + rules.getF1PolePoints() + ")");
        }
        if (pick.getRaceFastestLapDriverId() != null
                && Objects.equals(pick.getRaceFastestLapDriverId(), weekend.getFastestLapDriverId())) {
            points += rules.getF1FastestLapPoints();
            parts.add("vuelta rápida (+" + rules.getF1FastestLapPoints() + ")");
        }
        String details = parts.isEmpty() ? "Sin aciertos" : String.join(" · ", parts);
        return new Result(points, details.length() > 255 ? details.substring(0, 252) + "…" : details);
    }

    private static String name(Map<Long, String> names, Long driverId) {
        String name = names == null ? null : names.get(driverId);
        return name == null ? "Piloto" : name;
    }
}
