package app.porrapp.service.league;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.ScorerCandidateDTO;
import app.porrapp.dto.ScorerPickDTO;
import app.porrapp.dto.ScorerPickStateDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.Membership;
import app.porrapp.model.Prediction;
import app.porrapp.model.ScorerPick;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.ScorerPickRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.scoring.ScorerChoice;
import app.porrapp.scoring.ScorerNameMatcher;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.tournament.CompetitionPlayerService;
import app.porrapp.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Pichichi de cada porra: se elige de la lista de jugadores de la competición o se escribe a mano, y lo
 * escrito se empareja con el jugador real ({@link ScorerNameMatcher}). Si no se sabe a quién se refiere, el
 * administrador de la liga puede asignarle el jugador una vez cerrado el plazo.
 * <p>
 * En el cuadro de un torneo con grupos el pichichi viaja dentro del cuadro y se cierra con él; en las ligas
 * por jornadas se elige aparte, hasta que empieza el primer partido tras crear la liga (o, si la competición
 * ya estaba en juego, hasta el primero que se juegue pasada una semana, para que dé tiempo a entrar).
 */
@Service
@RequiredArgsConstructor
public class ScorerPickService {

    static final int NAME_MAX = 120;
    /** Con la competición ya empezada al crear la liga, margen para que entren los miembros y elijan. */
    static final Duration LATE_START_WINDOW = Duration.ofDays(7);
    /** Con más candidatos que estos, un pichichi dudoso se asigna eligiendo de la lista entera. */
    private static final int MAX_CANDIDATES = 12;

    private final EditionRepository editionRepository;
    private final PredictionRepository predictionRepository;
    private final ScorerPickRepository scorerPickRepository;
    private final UserAccountRepository userAccountRepository;
    private final MembershipRepository membershipRepository;
    private final MatchRepository matchRepository;
    private final CompetitionPlayerService competitionPlayerService;
    private final LeagueClosure leagueClosure;
    private final ScoreInvalidationService scoreInvalidationService;

    /** Jugadores de la competición con los que emparejar y si son sus plantillas o solo sus goleadores. */
    private record Players(List<ScorerCandidateDTO> all, boolean squads) {
        List<ScorerNameMatcher.Player> forMatching() {
            return all.stream().map(p -> new ScorerNameMatcher.Player(p.playerId(), p.name(), p.shortName())).toList();
        }

        Optional<ScorerCandidateDTO> byId(String playerId) {
            if (playerId == null || playerId.isBlank()) return Optional.empty();
            return all.stream().filter(p -> playerId.equals(p.playerId())).findFirst();
        }

        Optional<ScorerCandidateDTO> of(ScorerNameMatcher.Player player) {
            Optional<ScorerCandidateDTO> byId = byId(player.id());
            if (byId.isPresent()) return byId;
            return all.stream().filter(p -> p.name().equals(player.name())).findFirst();
        }
    }

    private Players players(Competition competition) {
        return new Players(competitionPlayerService.players(competition),
                competitionPlayerService.squadsKnown(competition));
    }

    /** Pichichi de la liga para quien consulta: si se juega, hasta cuándo y el suyo. */
    @Transactional(readOnly = true)
    public ScorerPickStateDTO state(Long leagueId, String email) {
        Edition edition = activeEdition(leagueId);
        if (!edition.scoresPichichi()) return ScorerPickStateDTO.disabled();
        Instant now = Instant.now();
        Instant lockAt = lockAt(edition);
        boolean locked = isLocked(edition, lockAt, now);
        ScorerPickDTO mine = null;
        if (email != null && !email.isBlank()) {
            Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, leagueId).orElse(null);
            if (prediction != null) {
                ScorerPick row = scorerPickRepository.findById(prediction.getId()).orElse(null);
                mine = view(edition, prediction, row, players(edition.getCompetition()), false);
            }
        }
        boolean canResolve = locked && isAdmin(edition.getLeague(), email) && !leagueClosure.isFinished(edition, now);
        return new ScorerPickStateDTO(true, edition.pichichiInBracket(), locked, lockAt, mine, canResolve);
    }

    /**
     * Guarda el pichichi de quien lo envía en una liga que lo elige aparte. Con {@code playerId} es ese jugador
     * de la lista; sin él, lo escrito, que se empareja con las plantillas si las hay. Vacío, lo quita.
     *
     * @throws BusinessException si la liga no lo juega, ya está cerrado o el jugador no es de la competición
     */
    @Transactional
    public ScorerPickStateDTO save(Long leagueId, String email, String name, String playerId) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
        Edition edition = activeEdition(leagueId);
        if (!edition.scoresPichichi()) {
            throw BusinessException.badRequest("Esta liga no juega el pichichi.");
        }
        if (edition.pichichiInBracket()) {
            throw BusinessException.badRequest("En esta liga el pichichi se elige al rellenar el cuadro.");
        }
        if (isLocked(edition, lockAt(edition), Instant.now())) {
            throw BusinessException.conflict("El plazo para elegir el pichichi ha terminado.");
        }
        Membership.MembershipId memberId = new Membership.MembershipId(user.getId(), leagueId);
        Membership membership = membershipRepository.findById(memberId).orElse(null);
        boolean publicLeague = edition.getLeague() != null && edition.getLeague().isPublicLeague();
        if (membership == null && !publicLeague) {
            throw BusinessException.forbidden("No perteneces a esta liga privada. Debes unirte primero con un código de invitación válido.");
        }
        String written = clean(name);
        if (written.length() > NAME_MAX) {
            throw BusinessException.badRequest("El nombre del pichichi es demasiado largo.");
        }
        boolean chosen = playerId != null && !playerId.isBlank();
        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, leagueId).orElse(null);
        if (written.isEmpty() && !chosen) {
            if (prediction != null) scorerPickRepository.findById(prediction.getId()).ifPresent(scorerPickRepository::delete);
            return state(leagueId, email);
        }
        if (prediction == null) {
            // La porra nueva entra en la clasificación.
            scoreInvalidationService.evictLeaderboardAfterCommit(leagueId);
            prediction = predictionRepository.save(Prediction.builder()
                    .user(user)
                    .edition(edition)
                    .name("Pronósticos de " + user.getParticipantName())
                    .paymentStatus(membership != null && membership.getPaymentStatus() != null
                            ? membership.getPaymentStatus() : "PENDING")
                    .createdAt(Instant.now())
                    .build());
        }
        Players players = players(edition.getCompetition());
        ScorerPick row = scorerPickRepository.findById(prediction.getId())
                .orElse(ScorerPick.builder().predictionId(prediction.getId()).build());
        if (chosen) {
            ScorerCandidateDTO player = players.byId(playerId)
                    .orElseThrow(() -> BusinessException.badRequest("Ese jugador no está en la lista de esta competición."));
            row.setWrittenName(fit(player.name()));
            row.setPlayerId(player.playerId());
            row.setPlayerName(player.name());
        } else {
            row.setWrittenName(written);
            // Sin plantillas no se fija a nadie: se emparejará con los goleadores al puntuar, como siempre.
            ScorerNameMatcher.Player matched = players.squads()
                    ? ScorerNameMatcher.resolve(written, players.forMatching()).player() : null;
            row.setPlayerId(matched == null || matched.id() == null || matched.id().isBlank() ? null : matched.id());
            row.setPlayerName(matched == null ? null : matched.name());
        }
        row.setResolvedByAdmin(false);
        row.setUpdatedAt(Instant.now());
        scorerPickRepository.save(row);
        return state(leagueId, email);
    }

    /**
     * Pichichis de la liga con el jugador al que se refiere cada uno. Con el plazo abierto solo se ve el
     * propio: enseñar los demás dejaría copiarlos.
     */
    @Transactional(readOnly = true)
    public List<ScorerPickDTO> picks(Long leagueId, String email) {
        Edition edition = activeEdition(leagueId);
        if (!edition.scoresPichichi()) return List.of();
        Instant now = Instant.now();
        boolean locked = isLocked(edition, lockAt(edition), now);
        boolean canResolve = locked && isAdmin(edition.getLeague(), email) && !leagueClosure.isFinished(edition, now);
        Map<Long, ScorerPick> rows = scorerPickRepository.findByEditionId(edition.getId()).stream()
                .collect(Collectors.toMap(ScorerPick::getPredictionId, row -> row));
        Players players = players(edition.getCompetition());
        List<ScorerPickDTO> picks = new ArrayList<>();
        for (Prediction prediction : predictionRepository.findByEditionLeagueIdWithUserAndEdition(leagueId)) {
            if (prediction.getEdition() == null || !edition.getId().equals(prediction.getEdition().getId())) continue;
            boolean own = email != null && prediction.getUser() != null
                    && email.equalsIgnoreCase(prediction.getUser().getGoogleEmail());
            if (!locked && !own) continue;
            ScorerPickDTO pick = view(edition, prediction, rows.get(prediction.getId()), players, canResolve);
            if (pick != null) picks.add(pick);
        }
        picks.sort(Comparator.comparing(pick -> pick.participantName() == null ? "" : pick.participantName(),
                String.CASE_INSENSITIVE_ORDER));
        return picks;
    }

    /**
     * El administrador asigna el jugador de un pichichi dudoso, o quita el que asignó ({@code playerId} vacío).
     * Solo con el plazo cerrado (antes no puede ver lo que han elegido los demás) y hasta que la liga termina.
     * Si lo escrito encaja con varios jugadores, solo puede ser uno de ellos.
     *
     * @throws BusinessException si no es el administrador, no es el momento o el pichichi no es dudoso
     */
    @Transactional
    public ScorerPickDTO assign(Long leagueId, Long predictionId, String playerId, String email) {
        Edition edition = activeEdition(leagueId);
        if (!isAdmin(edition.getLeague(), email)) {
            throw BusinessException.forbidden("Solo el administrador de la liga puede asignar un pichichi dudoso.");
        }
        if (!edition.scoresPichichi()) {
            throw BusinessException.badRequest("Esta liga no juega el pichichi.");
        }
        Instant now = Instant.now();
        if (!isLocked(edition, lockAt(edition), now)) {
            throw BusinessException.conflict("Los pichichis se pueden revisar cuando se cierre el plazo para elegirlos.");
        }
        if (leagueClosure.isFinished(edition, now)) {
            throw BusinessException.conflict("La liga ya ha terminado: sus pichichis no se pueden cambiar.");
        }
        Prediction prediction = predictionRepository.findById(predictionId)
                .filter(found -> found.getEdition() != null && edition.getId().equals(found.getEdition().getId()))
                .orElseThrow(() -> BusinessException.notFound("Predicción no encontrada"));
        ScorerPick row = scorerPickRepository.findById(predictionId).orElse(null);
        Players players = players(edition.getCompetition());
        ScorerPickDTO current = view(edition, prediction, row, players, true);
        if (current == null) {
            throw BusinessException.badRequest("Esa predicción no tiene pichichi.");
        }
        if (!current.canAssign()) {
            throw BusinessException.conflict("Ese pichichi no es dudoso: ya se sabe a qué jugador se refiere.");
        }
        if (playerId == null || playerId.isBlank()) {
            if (row != null && row.isResolvedByAdmin()) {
                if (edition.pichichiInBracket()) {
                    scorerPickRepository.delete(row);
                    row = null;
                } else {
                    row.setPlayerId(null);
                    row.setPlayerName(null);
                    row.setResolvedByAdmin(false);
                    row.setUpdatedAt(now);
                    scorerPickRepository.save(row);
                }
            }
        } else {
            ScorerCandidateDTO player = players.byId(playerId)
                    .orElseThrow(() -> BusinessException.badRequest("Ese jugador no está en la lista de esta competición."));
            List<ScorerCandidateDTO> fits = current.candidates();
            if (!fits.isEmpty() && fits.stream().noneMatch(fit -> playerId.equals(fit.playerId()))) {
                throw BusinessException.badRequest("Lo escrito solo puede referirse a uno de los jugadores con los que encaja.");
            }
            if (row == null) row = ScorerPick.builder().predictionId(predictionId).build();
            row.setWrittenName(fit(clean(current.writtenName())));
            row.setPlayerId(player.playerId());
            row.setPlayerName(player.name());
            row.setResolvedByAdmin(true);
            row.setUpdatedAt(now);
            scorerPickRepository.save(row);
        }
        scoreInvalidationService.invalidateEdition(edition.getId());
        return view(edition, prediction, row, players, true);
    }

    /**
     * Deja listo el pichichi de un cuadro antes de guardarlo: si se eligió de la lista, su nombre es el del
     * jugador; si se escribió a mano y encaja con un solo jugador de las plantillas, queda como ese jugador.
     * Un cuadro de una liga que no elige el pichichi dentro no lleva jugador.
     */
    @Transactional(readOnly = true)
    public void prepareBracketScorer(Edition edition, PredictionDataDTO bracket) {
        if (bracket == null) return;
        String playerId = bracket.getScorerPlayerId();
        bracket.setScorerPlayerId(null);
        if (edition == null || !edition.pichichiInBracket()) return;
        String written = clean(bracket.getScorer());
        boolean chosen = playerId != null && !playerId.isBlank();
        if (written.isEmpty() && !chosen) return;
        if (written.length() > NAME_MAX) {
            throw BusinessException.badRequest("El nombre del pichichi es demasiado largo.");
        }
        Players players = players(edition.getCompetition());
        ScorerCandidateDTO player = players.byId(chosen ? playerId : null).orElse(null);
        if (player == null && players.squads() && !written.isEmpty()) {
            ScorerNameMatcher.Player matched = ScorerNameMatcher.resolve(written, players.forMatching()).player();
            if (matched != null && matched.id() != null && !matched.id().isBlank()) {
                player = players.of(matched).orElse(null);
            }
        }
        if (player != null && !player.playerId().isBlank()) {
            bracket.setScorer(player.name());
            bracket.setScorerPlayerId(player.playerId());
        }
    }

    /** Pichichi de una porra tal como se enseña; null si no ha elegido. */
    private ScorerPickDTO view(Edition edition, Prediction prediction, ScorerPick row, Players players, boolean canResolve) {
        ScorerChoice choice = ScorerChoice.of(edition, prediction, row);
        if (choice.isBlank()) return null;
        Long userId = prediction.getUser() != null ? prediction.getUser().getId() : null;
        String participant = TextSanitizer.fixParticipantName(prediction.getParticipantName());
        if (choice.hasPlayer()) {
            String team = players.byId(choice.playerId()).map(ScorerCandidateDTO::team).orElse("");
            return new ScorerPickDTO(prediction.getId(), userId, participant, choice.written(), ScorerPickDTO.PLAYER,
                    choice.playerId(), choice.playerName(), team, choice.byAdmin(), canResolve && choice.byAdmin(), List.of());
        }
        ScorerNameMatcher.Resolution resolution = ScorerNameMatcher.resolve(choice.written(), players.forMatching());
        if (!resolution.doubtful()) {
            ScorerNameMatcher.Player matched = resolution.player();
            String team = players.of(matched).map(ScorerCandidateDTO::team).orElse("");
            return new ScorerPickDTO(prediction.getId(), userId, participant, choice.written(), ScorerPickDTO.MATCHED,
                    matched.id(), matched.name(), team, false, false, List.of());
        }
        // Si encaja con demasiados ("Luis"), lo escrito no acota nada: se elige de la lista entera.
        List<ScorerCandidateDTO> candidates = resolution.candidates().size() > MAX_CANDIDATES ? List.of()
                : resolution.candidates().stream().map(players::of).flatMap(Optional::stream).toList();
        // Sin plantillas, que nadie encaje todavía solo dice que ese jugador aún no ha marcado.
        String status = players.squads() || !resolution.candidates().isEmpty()
                ? ScorerPickDTO.DOUBTFUL : ScorerPickDTO.UNMATCHED;
        return new ScorerPickDTO(prediction.getId(), userId, participant, choice.written(), status,
                null, null, "", false, canResolve, candidates);
    }

    /**
     * Cuándo se cierra el pichichi. Dentro de un cuadro, con el cuadro. Aparte: al empezar el primer partido
     * de la competición tras crear la liga; si la competición ya estaba en juego, el primero que empiece pasado
     * {@link #LATE_START_WINDOW} y, si ya no queda ninguno tan tarde, el siguiente que se juegue.
     *
     * @return null si aún no se sabe (no hay calendario) o el cuadro no tiene fecha de cierre
     */
    Instant lockAt(Edition edition) {
        if (edition.pichichiInBracket()) return edition.getLockDate();
        Long competitionId = edition.getCompetition().getId();
        Instant created = edition.getCreatedAt() != null ? edition.getCreatedAt() : Instant.EPOCH;
        boolean started = matchRepository.existsByCompetitionIdAndMatchDateBefore(competitionId, created);
        if (!started) return firstMatchFrom(competitionId, created).orElse(null);
        return firstMatchFrom(competitionId, created.plus(LATE_START_WINDOW))
                .or(() -> firstMatchFrom(competitionId, created))
                .orElse(created);
    }

    private Optional<Instant> firstMatchFrom(Long competitionId, Instant from) {
        return matchRepository.findFirstByCompetitionIdAndMatchDateGreaterThanEqualOrderByMatchDateAsc(competitionId, from)
                .map(Match::getMatchDate);
    }

    private static boolean isLocked(Edition edition, Instant lockAt, Instant now) {
        return edition.isLocked() || lockAt != null && !now.isBefore(lockAt);
    }

    private Edition activeEdition(Long leagueId) {
        return editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("La liga no tiene una edición activa"));
    }

    private static boolean isAdmin(League league, String email) {
        return league != null && league.isAdmin(email);
    }

    /** Sin espacios de más ni caracteres de control. */
    private static String clean(String name) {
        if (name == null) return "";
        return name.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").trim();
    }

    private static String fit(String value) {
        return value.length() <= NAME_MAX ? value : value.substring(0, NAME_MAX);
    }
}
