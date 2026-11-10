package app.porrapp.service.formulaone;

import app.porrapp.dto.GrandPrixBoardDTO;
import app.porrapp.dto.GrandPrixPickRequest;
import app.porrapp.dto.RaceClassificationDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Edition;
import app.porrapp.model.Match;
import app.porrapp.model.MatchPrediction;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.RaceDriver;
import app.porrapp.model.RaceWeekend;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.RaceDriverRepository;
import app.porrapp.repository.RaceWeekendRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.sports.EspnFormulaOneClient;
import app.porrapp.util.AppTime;
import app.porrapp.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Predicciones de Gran Premio de una liga de Fórmula 1: podio, pole y vuelta rápida. Cada Gran Premio se
 * cierra al empezar la clasificación, que es la fecha de su fila de {@code matches}; las predicciones del
 * resto de la liga se ven a partir de ese momento.
 */
@Service
@RequiredArgsConstructor
public class GrandPrixService {

    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final RaceWeekendRepository raceWeekendRepository;
    private final RaceDriverRepository raceDriverRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final PredictionRepository predictionRepository;
    private final MembershipRepository membershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final LeagueService leagueService;
    private final ScoreInvalidationService scoreInvalidationService;
    private final RaceClassificationService classificationService;
    private final Clock clock = Clock.systemUTC();

    /** Grandes Premios de la temporada en curso con la predicción del usuario. */
    @Transactional(readOnly = true)
    public GrandPrixBoardDTO board(String email, Long groupId) {
        Edition edition = grandPrixEdition(groupId);
        leagueService.assertCanView(groupId, email);
        Instant now = clock.instant();

        List<Match> all = matchRepository.findByCompetitionIdOrderByMatchDateAsc(edition.getCompetition().getId());
        Map<Long, RaceWeekend> weekends = raceWeekendRepository.findByMatchIdIn(all.stream().map(Match::getId).toList())
                .stream().collect(Collectors.toMap(RaceWeekend::getMatchId, Function.identity()));
        List<Match> season = currentSeason(all, now);
        List<Long> latestGrid = latestGrid(all, weekends);

        Map<Long, MatchPrediction> mine = new HashMap<>();
        if (email != null && !email.isBlank()) {
            predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId).ifPresent(prediction ->
                    matchPredictionRepository.findByPredictionId(prediction.getId())
                            .forEach(pick -> mine.put(pick.getMatch().getId(), pick)));
        }

        List<GrandPrixBoardDTO.GrandPrix> grandsPrix = new ArrayList<>();
        Set<Long> driverIds = new LinkedHashSet<>(latestGrid);
        for (Match match : season) {
            RaceWeekend weekend = weekends.get(match.getId());
            List<Long> grid = weekend == null || weekend.entryDriverIds().isEmpty() ? latestGrid : weekend.entryDriverIds();
            MatchPrediction pick = mine.get(match.getId());
            GrandPrixBoardDTO.Picks result = weekend == null ? null : result(weekend);
            GrandPrixBoardDTO.Picks picked = pick == null ? null : picks(pick);
            driverIds.addAll(grid);
            Stream.of(result, picked).filter(Objects::nonNull).forEach(p -> driverIds.addAll(ids(p)));
            grandsPrix.add(new GrandPrixBoardDTO.GrandPrix(match.getId(), match.getRound(),
                    weekend == null ? null : weekend.getCircuit(),
                    weekend == null ? null : RacePlaces.city(weekend.getCity()),
                    weekend == null ? null : RacePlaces.country(weekend.getCountry()),
                    weekend != null && weekend.isSprint(),
                    match.getMatchDate(), weekend == null ? null : weekend.getRaceAt(),
                    match.getStatus() == null ? MatchStatusNormalized.SCHEDULED.name() : match.getStatus().name(),
                    isLocked(edition, match, now), grid, result, picked,
                    pick == null ? null : pick.getPointsAwarded(),
                    pick == null ? null : pick.getScoringDetails()));
        }

        ScoringRuleSet rules = ScoringRuleSet.forEdition(edition);
        return new GrandPrixBoardDTO(grandsPrix, drivers(driverIds),
                new GrandPrixBoardDTO.Rules(rules.getF1ExactPositionPoints(), rules.getF1PodiumPoints(),
                        rules.getF1PolePoints(), rules.getF1FastestLapPoints()));
    }

    /** Guarda o cambia la predicción del usuario para un Gran Premio que aún no ha cerrado. */
    @Transactional
    public GrandPrixBoardDTO savePick(String email, Long groupId, Long matchId, GrandPrixPickRequest request) {
        if (email == null || email.isBlank()) throw BusinessException.forbidden("Usuario no autenticado");
        Edition edition = grandPrixEdition(groupId);
        if (edition.isLocked()) throw BusinessException.conflict("La liga está cerrada.");
        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
        Membership.MembershipId memberId = new Membership.MembershipId(user.getId(), groupId);
        boolean publicLeague = edition.getLeague() != null && edition.getLeague().isPublicLeague();
        if (!membershipRepository.existsById(memberId) && !publicLeague) {
            throw BusinessException.forbidden("No perteneces a esta liga privada.");
        }

        Match match = grandPrixOf(edition, matchId);
        if (isLocked(edition, match, clock.instant())) {
            throw BusinessException.conflict("La predicción de este Gran Premio ya está cerrada: empezó la clasificación.");
        }
        validate(request, gridFor(match));

        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                .orElseGet(() -> {
                    Membership membership = membershipRepository.findById(memberId).orElse(null);
                    scoreInvalidationService.evictLeaderboardAfterCommit(groupId);
                    return predictionRepository.save(Prediction.builder()
                            .user(user)
                            .edition(edition)
                            .name("Pronósticos de " + user.getParticipantName())
                            .paymentStatus(membership != null && membership.getPaymentStatus() != null
                                    ? membership.getPaymentStatus() : "PENDING")
                            .createdAt(Instant.now())
                            .build());
                });
        MatchPrediction pick = matchPredictionRepository.findByPredictionIdAndMatchIdIn(prediction.getId(), List.of(match.getId()))
                .stream().findFirst()
                .orElseGet(() -> MatchPrediction.builder().prediction(prediction).match(match).build());
        pick.setRaceFirstDriverId(request.first());
        pick.setRaceSecondDriverId(request.second());
        pick.setRaceThirdDriverId(request.third());
        pick.setRacePoleDriverId(request.pole());
        pick.setRaceFastestLapDriverId(request.fastestLap());
        pick.setPointsAwarded(null);
        pick.setScoringDetails(null);
        matchPredictionRepository.save(pick);
        return board(email, groupId);
    }

    /**
     * Predicciones de la liga para un Gran Premio. Antes del cierre solo se ve la propia, para que nadie
     * copie a nadie.
     */
    @Transactional(readOnly = true)
    public List<GrandPrixBoardDTO.MemberPick> memberPicks(String email, Long groupId, Long matchId) {
        Edition edition = grandPrixEdition(groupId);
        leagueService.assertCanView(groupId, email);
        Match match = grandPrixOf(edition, matchId);
        boolean revealed = isLocked(edition, match, clock.instant());
        List<GrandPrixBoardDTO.MemberPick> picks = new ArrayList<>();
        for (MatchPrediction pick : matchPredictionRepository.findByMatchId(match.getId())) {
            Prediction prediction = pick.getPrediction();
            if (prediction == null || prediction.getEdition() == null
                    || !Objects.equals(prediction.getEdition().getId(), edition.getId())) continue;
            GrandPrixBoardDTO.MemberPick member = memberPick(pick, email);
            if (!revealed && !member.mine()) continue;
            picks.add(member);
        }
        picks.sort(MEMBER_ORDER);
        return picks;
    }

    /**
     * Predicciones de la liga en los Grandes Premios de la temporada que ya han cerrado, por fecha. Los que
     * siguen abiertos no aparecen, ni siquiera con la predicción propia: nada se agrega antes del cierre.
     */
    @Transactional(readOnly = true)
    public List<GrandPrixBoardDTO.RacePicks> seasonPicks(String email, Long groupId) {
        Edition edition = grandPrixEdition(groupId);
        leagueService.assertCanView(groupId, email);
        Instant now = clock.instant();
        List<Match> all = matchRepository.findByCompetitionIdOrderByMatchDateAsc(edition.getCompetition().getId());
        Map<Long, List<GrandPrixBoardDTO.MemberPick>> closed = new LinkedHashMap<>();
        for (Match match : currentSeason(all, now)) {
            if (isLocked(edition, match, now)) closed.put(match.getId(), new ArrayList<>());
        }
        if (closed.isEmpty()) return List.of();
        for (MatchPrediction pick : matchPredictionRepository.findWithMatchAndUserByEditionId(edition.getId())) {
            List<GrandPrixBoardDTO.MemberPick> picks = closed.get(pick.getMatch().getId());
            if (picks != null) picks.add(memberPick(pick, email));
        }
        return closed.entrySet().stream()
                .map(entry -> new GrandPrixBoardDTO.RacePicks(entry.getKey(),
                        entry.getValue().stream().sorted(MEMBER_ORDER).toList()))
                .toList();
    }

    /** Más puntos primero y, a igualdad, por nombre. */
    private static final Comparator<GrandPrixBoardDTO.MemberPick> MEMBER_ORDER = Comparator
            .comparing((GrandPrixBoardDTO.MemberPick p) -> p.points() == null ? 0 : p.points()).reversed()
            .thenComparing(p -> p.name() == null ? "" : p.name(), String.CASE_INSENSITIVE_ORDER);

    private static GrandPrixBoardDTO.MemberPick memberPick(MatchPrediction pick, String email) {
        Prediction prediction = pick.getPrediction();
        UserAccount owner = prediction.getUser();
        boolean mine = owner != null && email != null && email.equalsIgnoreCase(owner.getGoogleEmail());
        return new GrandPrixBoardDTO.MemberPick(owner == null ? null : owner.getId(),
                TextSanitizer.fixParticipantName(prediction.getParticipantName()),
                owner == null ? null : owner.getAvatarUrl(), mine, picks(pick), pick.getPointsAwarded(),
                pick.getScoringDetails());
    }

    /** Clasificación completa de un Gran Premio de la liga; vacía hasta que acaba la carrera. */
    public RaceClassificationDTO classification(String email, Long groupId, Long matchId) {
        Edition edition = grandPrixEdition(groupId);
        leagueService.assertCanView(groupId, email);
        return classificationService.classification(grandPrixOf(edition, matchId));
    }

    /**
     * Comprueba que la liga es de Fórmula 1 y que el usuario puede verla.
     *
     * @return el año de su temporada si ya está archivada (su Mundial es el de ese año, no el que está en
     * curso), o null si juega la temporada vigente
     */
    @Transactional(readOnly = true)
    public Integer standingsSeason(String email, Long groupId) {
        Edition edition = grandPrixEdition(groupId);
        leagueService.assertCanView(groupId, email);
        if (!edition.getCompetition().isArchived()) return null;
        Integer year = edition.getCompetition().seasonStartYear();
        // Sin saber de qué año es, enseñar el Mundial en curso sería enseñar el de otra temporada.
        if (year == null) throw BusinessException.notFound("El Mundial de esa temporada ya no está disponible");
        return year;
    }

    private Edition grandPrixEdition(Long groupId) {
        if (groupId == null) throw BusinessException.badRequest("Falta la liga");
        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("La liga no tiene una edición activa"));
        if (!PoolFormat.isRaceBased(edition.getPoolFormat()) || edition.getCompetition() == null) {
            throw BusinessException.badRequest("Esta liga no es de Fórmula 1.");
        }
        return edition;
    }

    private Match grandPrixOf(Edition edition, Long matchId) {
        Match match = matchId == null ? null : matchRepository.findById(matchId).orElse(null);
        if (match == null || match.getCompetition() == null
                || !Objects.equals(match.getCompetition().getId(), edition.getCompetition().getId())) {
            throw BusinessException.notFound("Gran Premio no encontrado");
        }
        return match;
    }

    /** Cerrado al empezar la clasificación, o si el Gran Premio ya no está programado. */
    static boolean isLocked(Edition edition, Match match, Instant now) {
        if (edition.isLocked()) return true;
        if (match.getStatus() != null && !match.getStatus().isOpenForPrediction()) return true;
        if (Boolean.TRUE.equals(match.getFinished())) return true;
        return match.getMatchDate() == null || !now.isBefore(match.getMatchDate());
    }

    private List<Long> gridFor(Match match) {
        RaceWeekend weekend = raceWeekendRepository.findById(match.getId()).orElse(null);
        if (weekend != null && !weekend.entryDriverIds().isEmpty()) return weekend.entryDriverIds();
        List<Match> all = matchRepository.findByCompetitionIdOrderByMatchDateAsc(match.getCompetition().getId());
        Map<Long, RaceWeekend> weekends = raceWeekendRepository.findByMatchIdIn(all.stream().map(Match::getId).toList())
                .stream().collect(Collectors.toMap(RaceWeekend::getMatchId, Function.identity()));
        return latestGrid(all, weekends);
    }

    private void validate(GrandPrixPickRequest request, List<Long> grid) {
        if (request == null || request.first() == null || request.second() == null || request.third() == null
                || request.pole() == null) {
            throw BusinessException.badRequest("Elige el podio completo y la pole.");
        }
        if (new HashSet<>(List.of(request.first(), request.second(), request.third())).size() != 3) {
            throw BusinessException.badRequest("Un piloto no puede ocupar dos puestos del podio.");
        }
        Set<Long> chosen = new HashSet<>(List.of(request.first(), request.second(), request.third(), request.pole()));
        if (request.fastestLap() != null) chosen.add(request.fastestLap());
        Set<Long> known = raceDriverRepository.findAllById(chosen).stream().map(RaceDriver::getId).collect(Collectors.toSet());
        if (!known.containsAll(chosen) || (!grid.isEmpty() && !new HashSet<>(grid).containsAll(chosen))) {
            throw BusinessException.badRequest("Elige pilotos que corran este Gran Premio.");
        }
    }

    /**
     * Grandes Premios del año en curso: el del próximo sin terminar o, si ya no queda ninguno, el del
     * último. Así la pantalla no acumula temporadas pasadas.
     */
    static List<Match> currentSeason(List<Match> all, Instant now) {
        Match current = all.stream()
                .filter(m -> m.getMatchDate() != null && !Boolean.TRUE.equals(m.getFinished())
                        && m.getStatus() != MatchStatusNormalized.CANCELLED && m.getMatchDate().isAfter(now.minusSeconds(4 * 24 * 3600)))
                .findFirst()
                .orElse(all.isEmpty() ? null : all.get(all.size() - 1));
        if (current == null || current.getMatchDate() == null) return all;
        int year = AppTime.day(current.getMatchDate()).getYear();
        return all.stream()
                .filter(m -> m.getMatchDate() != null && AppTime.day(m.getMatchDate()).getYear() == year)
                .toList();
    }

    /** Parrilla de la última carrera con lista de inscritos publicada. */
    private static List<Long> latestGrid(List<Match> all, Map<Long, RaceWeekend> weekends) {
        for (int i = all.size() - 1; i >= 0; i--) {
            RaceWeekend weekend = weekends.get(all.get(i).getId());
            if (weekend != null && !weekend.entryDriverIds().isEmpty()) return weekend.entryDriverIds();
        }
        return List.of();
    }

    private List<GrandPrixBoardDTO.Driver> drivers(Set<Long> ids) {
        Map<Long, RaceDriver> byId = raceDriverRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(RaceDriver::getId, Function.identity()));
        return ids.stream().map(byId::get).filter(Objects::nonNull)
                .map(d -> new GrandPrixBoardDTO.Driver(d.getId(), d.getName(), d.getShortName(),
                        RacePlaces.country(d.getCountry()),
                        d.getFlagUrl(), d.getTeamName(), d.getTeamColor(), d.getCarNumber(),
                        EspnFormulaOneClient.headshotUrl(d.getExternalId())))
                .toList();
    }

    private static GrandPrixBoardDTO.Picks result(RaceWeekend weekend) {
        if (weekend.getPoleDriverId() == null && !weekend.hasPodium()) return null;
        return new GrandPrixBoardDTO.Picks(weekend.getFirstDriverId(), weekend.getSecondDriverId(),
                weekend.getThirdDriverId(), weekend.getPoleDriverId(), weekend.getFastestLapDriverId());
    }

    private static GrandPrixBoardDTO.Picks picks(MatchPrediction pick) {
        return new GrandPrixBoardDTO.Picks(pick.getRaceFirstDriverId(), pick.getRaceSecondDriverId(),
                pick.getRaceThirdDriverId(), pick.getRacePoleDriverId(), pick.getRaceFastestLapDriverId());
    }

    private static List<Long> ids(GrandPrixBoardDTO.Picks picks) {
        return Stream.of(picks.first(), picks.second(), picks.third(), picks.pole(), picks.fastestLap())
                .filter(Objects::nonNull).toList();
    }
}
