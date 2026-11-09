package app.porrapp.service.sync;

import app.porrapp.model.EditionMatchChoice;
import app.porrapp.model.Fight;
import app.porrapp.model.FightMethod;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.Team;
import app.porrapp.repository.EditionMatchChoiceRepository;
import app.porrapp.repository.FightRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.service.notification.FightCardChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

/**
 * Datos de pelea de los partidos de la UFC y cambios de cartelera.
 * <p>
 * Una pelea que desaparece de la cartelera de ESPN antes de acabar se da por cancelada: no puntúa a nadie y
 * sus predicciones se anulan. Si cambia uno de los luchadores (mismo combate con otro rival), la predicción
 * también se anula, porque se hizo sobre otra pelea. En ambos casos se avisa a quien había predicho.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FightCardService {

    private final FightRepository fightRepository;
    private final MatchRepository matchRepository;
    private final EditionMatchChoiceRepository choiceRepository;
    private final ApplicationEventPublisher events;

    /**
     * Guarda los datos de pelea de un partido recién guardado y revisa su cartelera.
     *
     * @param ufc           nodo {@code ufc} del evento que da {@code UfcDataProvider}
     * @param previousHome  luchador de la esquina roja antes de esta pasada; null si el partido es nuevo
     * @param previousAway  luchador de la esquina azul antes de esta pasada; null si el partido es nuevo
     * @return si ha cambiado cómo acabó la pelea (método o asalto), que cambia los puntos
     */
    @Transactional
    public boolean apply(Match match, JsonNode ufc, Team previousHome, Team previousAway, MatchEventProcessor.Batch batch) {
        String eventId = text(ufc, "eventId");
        if (match == null || match.getId() == null || eventId == null) return false;

        Fight fight = fightRepository.findById(match.getId()).orElse(null);
        boolean created = fight == null;
        if (created) fight = Fight.builder().matchId(match.getId()).build();
        Fight f = fight;
        boolean changed = created;
        changed |= set(f.getEventExternalId(), eventId, f::setEventExternalId);
        changed |= set(f.getCardSegment(), text(ufc, "segment"), f::setCardSegment);
        changed |= set(f.getBoutOrder(), number(ufc, "order"), f::setBoutOrder);
        changed |= set(f.getWeightClass(), text(ufc, "weightClass"), f::setWeightClass);
        changed |= set(f.getTitle(), text(ufc, "title"), f::setTitle);
        changed |= set(f.getScheduledRounds(), number(ufc, "rounds"), f::setScheduledRounds);
        changed |= set(f.getHomeRecord(), text(ufc, "homeRecord"), f::setHomeRecord);
        changed |= set(f.getAwayRecord(), text(ufc, "awayRecord"), f::setAwayRecord);
        boolean resultChanged = set(f.getResultMethod(), FightMethod.fromEspn(text(ufc, "method")), f::setResultMethod)
                | set(f.getResultRound(), number(ufc, "round"), f::setResultRound);
        changed |= resultChanged;
        changed |= set(f.getResultDetail(), text(ufc, "methodDetail"), f::setResultDetail);
        changed |= set(f.getResultClock(), text(ufc, "clock"), f::setResultClock);
        changed |= set(f.getJudgesScores(), text(ufc, "judgesScores"), f::setJudgesScores);
        if (changed) fightRepository.save(f);
        if (created) includeInSingleEventLeagues(f);

        List<FightCardChangedEvent.Notice> notices = new ArrayList<>();
        if (previousHome != null && previousAway != null) checkCorners(match, previousHome, previousAway, notices);
        if (batch.firstTime("ufc-card:" + eventId) && reconcileCard(eventId, ufc.path("card"), notices) > 0) {
            batch.markResultsChanged();
        }
        if (!notices.isEmpty()) events.publishEvent(new FightCardChangedEvent(List.copyOf(notices)));
        return resultChanged;
    }

    /** La pelea entra sola en las ligas de una sola velada que siguen su velada. */
    private void includeInSingleEventLeagues(Fight fight) {
        for (Long editionId : fightRepository.findEditionIdsFollowingEvent(fight.getEventExternalId())) {
            EditionMatchChoice.Key key = new EditionMatchChoice.Key(editionId, fight.getMatchId());
            if (!choiceRepository.existsById(key)) choiceRepository.save(new EditionMatchChoice(key, true));
        }
    }

    /**
     * Mismo combate con otros luchadores. Si solo se han cambiado de esquina, la predicción sigue valiendo
     * (se cambia de lado); si hay un luchador nuevo, se anula.
     */
    private void checkCorners(Match match, Team previousHome, Team previousAway, List<FightCardChangedEvent.Notice> notices) {
        Long home = id(match.getHomeTeam());
        Long away = id(match.getAwayTeam());
        Long oldHome = id(previousHome);
        Long oldAway = id(previousAway);
        if (Objects.equals(home, oldHome) && Objects.equals(away, oldAway)) return;
        if (Boolean.TRUE.equals(match.getFinished())) return;
        if (Objects.equals(home, oldAway) && Objects.equals(away, oldHome)) {
            fightRepository.swapPredictedCorners(match.getId());
            return;
        }
        if (Team.isPlaceholder(previousHome) || Team.isPlaceholder(previousAway)) return;
        Team stays = Objects.equals(home, oldHome) || Objects.equals(away, oldHome) ? previousHome
                : Objects.equals(home, oldAway) || Objects.equals(away, oldAway) ? previousAway : null;
        String event = match.getRound();
        String title = stays != null ? name(stays) + " tiene nuevo rival" : "Cambio en la cartelera";
        String body = name(match.getHomeTeam()) + " vs. " + name(match.getAwayTeam())
                + (event != null ? " (" + event + ")" : "")
                + ". Tu predicción de " + name(previousHome) + " vs. " + name(previousAway)
                + " se ha anulado: vuelve a predecir.";
        voidPredictions(match, title, body, notices);
        log.info("Cambio de rival en {}: {} vs {} pasa a {} vs {}", event, name(previousHome), name(previousAway),
                name(match.getHomeTeam()), name(match.getAwayTeam()));
    }

    /**
     * Da por canceladas las peleas de la velada que ya no están en su cartelera.
     *
     * @return peleas canceladas
     */
    int reconcileCard(String eventId, JsonNode card, List<FightCardChangedEvent.Notice> notices) {
        // Sin cartelera no se puede saber qué falta: nunca se cancela todo por una respuesta incompleta.
        if (card == null || !card.isArray() || card.isEmpty()) return 0;
        Set<String> onCard = new HashSet<>();
        Map<String, String> opponentOf = new HashMap<>();
        for (JsonNode bout : card) {
            onCard.add(bout.path("id").asText());
            opponentOf.put(bout.path("home").asText(), bout.path("awayName").asText());
            opponentOf.put(bout.path("away").asText(), bout.path("homeName").asText());
        }
        List<Long> ids = fightRepository.findByEventExternalId(eventId).stream().map(Fight::getMatchId).toList();
        int cancelled = 0;
        for (Match match : matchRepository.findAllById(ids)) {
            if (onCard.contains(match.getExternalId()) || Boolean.TRUE.equals(match.getFinished())
                    || match.getStatus() == MatchStatusNormalized.CANCELLED) {
                continue;
            }
            match.setStatus(MatchStatusNormalized.CANCELLED);
            match.setDisplayClock(null);
            matchRepository.save(match);
            cancelled++;
            String home = name(match.getHomeTeam());
            String away = name(match.getAwayTeam());
            String event = match.getRound();
            String newOpponent = null;
            Team stays = null;
            for (Team fighter : new Team[]{match.getHomeTeam(), match.getAwayTeam()}) {
                String opponent = fighter == null ? null : opponentOf.get(fighter.getExternalId());
                if (opponent != null) {
                    newOpponent = opponent;
                    stays = fighter;
                    break;
                }
            }
            String title = stays != null ? name(stays) + " tiene nuevo rival" : "Pelea cancelada";
            String body = stays != null
                    ? name(stays) + " pelea ahora contra " + newOpponent + (event != null ? " en " + event : "")
                            + ". Tu predicción de " + home + " vs. " + away + " se ha anulado: vuelve a predecir."
                    : home + " vs. " + away + (event != null ? " (" + event + ")" : "")
                            + " se ha caído de la cartelera. Tu predicción no cuenta.";
            voidPredictions(match, title, body, notices);
            log.info("Pelea cancelada en {}: {} vs {}", event, home, away);
        }
        return cancelled;
    }

    private void voidPredictions(Match match, String title, String body, List<FightCardChangedEvent.Notice> notices) {
        for (Object[] row : fightRepository.findPredictorsOfMatch(match.getId())) {
            notices.add(new FightCardChangedEvent.Notice((Long) row[0], (Long) row[1], (String) row[2], title, body));
        }
        fightRepository.deletePredictionsOfMatch(match.getId());
    }

    private static Long id(Team team) {
        return team == null ? null : team.getId();
    }

    private static String name(Team team) {
        return team == null || team.getName() == null ? Team.PLACEHOLDER_NAME : team.getName();
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isValueNode() || value.isNull()) return null;
        String text = value.asText("").trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer number(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isIntegralNumber() ? value.asInt() : null;
    }

    private static <T> boolean set(T current, T value, Consumer<T> setter) {
        if (Objects.equals(current, value)) return false;
        setter.accept(value);
        return true;
    }
}
