package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerDTO.Day;
import app.porrapp.dto.ScoreTrackerDTO.Game;
import app.porrapp.dto.ScoreTrackerDTO.GameStandings;
import app.porrapp.dto.ScoreTrackerDTO.Player;
import app.porrapp.dto.ScoreTrackerDTO.Round;
import app.porrapp.dto.ScoreTrackerDTO.Session;
import app.porrapp.dto.ScoreTrackerDTO.Standing;
import app.porrapp.model.League;
import app.porrapp.model.ScoreDay;
import app.porrapp.model.ScoreDayPlayer;
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreSessionPlayer;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.repository.ScoreDayPlayerRepository;
import app.porrapp.repository.ScoreDayRepository;
import app.porrapp.repository.ScoreGameRepository;
import app.porrapp.repository.ScoreSessionPlayerRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerRoundRepository;
import app.porrapp.repository.ScoreTrackerScoreRepository;
import app.porrapp.repository.ScoreTrackerSessionRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Monta la vista completa de una liga de marcador: partidas, rondas, días de juego y clasificaciones. */
@Component
@RequiredArgsConstructor
class ScoreTrackerViewBuilder {

    private final ScoreGameRepository games;
    private final ScoreTrackerPlayerRepository players;
    private final ScoreTrackerSessionRepository sessions;
    private final ScoreTrackerRoundRepository rounds;
    private final ScoreTrackerScoreRepository scores;
    private final ScoreDayRepository days;
    private final ScoreDayPlayerRepository dayPlayers;
    private final ScoreSessionPlayerRepository sessionPlayers;

    public ScoreTrackerDTO build(League league, Long userId) {
        Long leagueId = league.getId();
        List<ScoreTrackerPlayer> playerRows = players.findByLeagueIdOrderByPositionAsc(leagueId);
        List<Player> playerList = playerRows.stream()
                .map(player -> new Player(player.getId(), player.getName())).toList();
        Map<Long, String> nameByUser = new HashMap<>();
        playerRows.stream().filter(player -> player.getUserId() != null)
                .forEach(player -> nameByUser.put(player.getUserId(), player.getName()));
        Long myPlayerId = playerRows.stream().filter(player -> userId.equals(player.getUserId()))
                .map(ScoreTrackerPlayer::getId).findFirst().orElse(null);
        List<Long> claimed = playerRows.stream().filter(player -> player.getUserId() != null)
                .map(ScoreTrackerPlayer::getId).toList();
        List<ScoreGame> gameRows = games.findByLeagueIdOrderByIdAsc(leagueId);
        Map<Long, ScoreGame> gameById = gameRows.stream()
                .collect(Collectors.toMap(ScoreGame::getId, game -> game, (a, b) -> a, LinkedHashMap::new));
        List<ScoreTrackerSession> sessionList = sessions.findByLeagueIdOrderByIdAsc(leagueId);
        List<ScoreTrackerRound> roundList = rounds.findByLeagueIdOrderByIdAsc(leagueId);
        Map<Long, Map<Long, Integer>> pointsByRound = new HashMap<>();
        Collection<Long> roundIds = roundList.stream().map(ScoreTrackerRound::getId).toList();
        if (!roundIds.isEmpty()) {
            for (ScoreTrackerScore score : scores.findByRoundIdIn(roundIds)) {
                pointsByRound.computeIfAbsent(score.getRoundId(), key -> new LinkedHashMap<>())
                        .put(score.getPlayerId(), score.getPoints());
            }
        }
        Map<Long, List<ScoreTrackerRound>> roundsBySession = roundList.stream()
                .collect(Collectors.groupingBy(ScoreTrackerRound::getSessionId));
        Map<Long, Set<Long>> participantsBySession = new HashMap<>();
        List<Long> sessionIds = sessionList.stream().map(ScoreTrackerSession::getId).toList();
        if (!sessionIds.isEmpty()) {
            for (ScoreSessionPlayer row : sessionPlayers.findBySessionIdIn(sessionIds)) {
                participantsBySession.computeIfAbsent(row.getSessionId(), key -> new HashSet<>())
                        .add(row.getPlayerId());
            }
        }

        List<Session> sessionViews = new ArrayList<>();
        Map<Long, Map<Long, Integer>> totalsByGame = new HashMap<>();
        Map<Long, Map<Long, Integer>> roundsWonByGame = new HashMap<>();
        Map<Long, Map<Long, Integer>> wonByGame = new HashMap<>();
        Map<Long, Map<Long, Integer>> playedByGame = new HashMap<>();
        Map<Long, Integer> roundCountByGame = new HashMap<>();
        Map<Long, Integer> sessionCountByGame = new HashMap<>();
        int number = 1;
        for (ScoreTrackerSession session : sessionList) {
            ScoreGame game = gameById.get(session.getGameId());
            List<ScoreTrackerRound> own = roundsBySession.getOrDefault(session.getId(), List.of());
            List<Map<Long, Integer>> ownPoints = own.stream()
                    .map(round -> pointsByRound.getOrDefault(round.getId(), Map.<Long, Integer>of())).toList();
            Set<Long> scored = new HashSet<>();
            ownPoints.forEach(points -> scored.addAll(points.keySet()));
            Set<Long> participants = new HashSet<>(participantsBySession.getOrDefault(session.getId(), Set.of()));
            participants.addAll(scored);
            List<Player> sessionPlayerList = playerList.stream()
                    .filter(player -> participants.contains(player.id())).toList();
            boolean lowerWins = game != null && !game.isWins() && game.isLowerWins();
            List<Standing> standings = ScoreTrackerStandings.rank(sessionPlayerList, lowerWins, ownPoints,
                    game != null && ScoreGame.MODE_ROUNDS.equals(game.getMode()));
            List<Long> winners = ScoreTrackerStandings.leaders(standings, own.size());
            if (game != null && game.getTargetWins() != null) {
                Set<Long> reached = standings.stream().filter(row -> row.roundsWon() >= game.getTargetWins())
                        .map(Standing::playerId).collect(Collectors.toSet());
                winners = winners.stream().filter(reached::contains).toList();
            }
            Long gameKey = session.getGameId();
            Map<Long, Integer> totals = totalsByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            Map<Long, Integer> roundsWon = roundsWonByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            Map<Long, Integer> won = wonByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            Map<Long, Integer> played = playedByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            for (Standing standing : standings) {
                if (!scored.contains(standing.playerId())) continue;
                totals.merge(standing.playerId(), standing.total(), Integer::sum);
                roundsWon.merge(standing.playerId(), standing.roundsWon(), Integer::sum);
                if (!session.isOpen()) played.merge(standing.playerId(), 1, Integer::sum);
            }
            if (!session.isOpen()) winners.forEach(id -> won.merge(id, 1, Integer::sum));
            roundCountByGame.merge(gameKey, own.size(), Integer::sum);
            sessionCountByGame.merge(gameKey, 1, Integer::sum);
            sessionViews.add(new Session(session.getId(), number++, gameKey, session.getStartedAt().toString(),
                    own.size(), standings, winners, session.getDayId(),
                    playerList.stream().map(Player::id).filter(participants::contains).toList(),
                    session.getEndedAt() == null ? null : session.getEndedAt().toString(),
                    session.getPlannedRounds()));
        }
        int roundNumber = 1;
        List<Round> roundViews = new ArrayList<>();
        for (ScoreTrackerRound round : roundList) {
            roundViews.add(new Round(round.getId(), round.getSessionId(), roundNumber++, round.getNote(),
                    round.getCreatedAt().toString(), pointsByRound.getOrDefault(round.getId(), Map.of()),
                    round.getCreatedByUserId() == null ? null : nameByUser.get(round.getCreatedByUserId()),
                    round.getRevision()));
        }

        List<Game> gameViews = new ArrayList<>();
        List<GameStandings> byGame = new ArrayList<>();
        Map<Long, Integer> totals = new HashMap<>();
        Map<Long, Integer> roundsWon = new HashMap<>();
        Map<Long, Integer> sessionsWon = new HashMap<>();
        Map<Long, Integer> sessionsPlayed = new HashMap<>();
        for (ScoreGame game : gameRows) {
            Map<Long, Integer> gameTotals = totalsByGame.getOrDefault(game.getId(), Map.of());
            Map<Long, Integer> gameRoundsWon = roundsWonByGame.getOrDefault(game.getId(), Map.of());
            Map<Long, Integer> gameWon = wonByGame.getOrDefault(game.getId(), Map.of());
            Map<Long, Integer> gamePlayed = playedByGame.getOrDefault(game.getId(), Map.of());
            List<Player> gamePlayers = playerList.stream()
                    .filter(player -> gameTotals.containsKey(player.id())).toList();
            byGame.add(new GameStandings(game.getId(),
                    ScoreTrackerStandings.general(gamePlayers, gameTotals, gameRoundsWon, gameWon, gamePlayed)));
            gameTotals.forEach((id, value) -> totals.merge(id, value, Integer::sum));
            gameRoundsWon.forEach((id, value) -> roundsWon.merge(id, value, Integer::sum));
            gameWon.forEach((id, value) -> sessionsWon.merge(id, value, Integer::sum));
            gamePlayed.forEach((id, value) -> sessionsPlayed.merge(id, value, Integer::sum));
            gameViews.add(new Game(game.getId(), game.getName(), game.getUnit(), game.isLowerWins(),
                    sessionCountByGame.getOrDefault(game.getId(), 0),
                    roundCountByGame.getOrDefault(game.getId(), 0), game.getMode(), game.getTargetWins()));
        }
        List<Standing> overall = ScoreTrackerStandings.general(playerList, totals, roundsWon, sessionsWon,
                sessionsPlayed);

        List<ScoreDay> dayRows = days.findByLeagueIdOrderByIdAsc(leagueId);
        Map<Long, Set<Long>> attendeesByDay = new HashMap<>();
        if (!dayRows.isEmpty()) {
            for (ScoreDayPlayer row : dayPlayers.findByDayIdIn(dayRows.stream().map(ScoreDay::getId).toList())) {
                attendeesByDay.computeIfAbsent(row.getDayId(), key -> new HashSet<>()).add(row.getPlayerId());
            }
        }
        List<Day> dayViews = new ArrayList<>();
        Long currentDayId = null;
        for (ScoreDay day : dayRows) {
            Set<Long> attendees = attendeesByDay.getOrDefault(day.getId(), Set.of());
            dayViews.add(new Day(day.getId(), day.getStartedAt().toString(),
                    day.getClosedAt() == null ? null : day.getClosedAt().toString(),
                    playerList.stream().map(Player::id).filter(attendees::contains).toList(),
                    sessionList.stream().filter(session -> session.getDayId().equals(day.getId()))
                            .map(ScoreTrackerSession::getId).toList(), day.getPlayedOn().toString()));
            if (day.isOpen()) {
                currentDayId = day.getId();
            }
        }

        ScoreTrackerSession currentSession = sessionList.isEmpty() ? null : sessionList.get(sessionList.size() - 1);
        ScoreGame current = currentSession != null ? gameById.get(currentSession.getGameId())
                : gameRows.isEmpty() ? null : gameRows.get(0);
        return new ScoreTrackerDTO(leagueId, league.getName(), current == null ? "puntos" : current.getUnit(),
                current != null && current.isLowerWins(), ScoreTrackerService.administers(league, userId), league.getJoinCode(),
                myPlayerId, claimed, currentSession == null ? null : currentSession.getId(),
                current == null ? null : current.getId(), gameViews, playerList, sessionViews, roundViews,
                overall, byGame, currentDayId, dayViews);
    }
}
