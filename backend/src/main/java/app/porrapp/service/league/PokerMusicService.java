package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.AddTrack;
import app.porrapp.dto.PokerDTO.MusicQueue;
import app.porrapp.dto.PokerDTO.MusicSearch;
import app.porrapp.dto.PokerDTO.QueuedTrack;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.PokerMusicItem;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PokerMusicRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/** Cola de canciones de una liga de póker: la piden los jugadores y la reproduce el organizador en el modo TV. */
@Service
@RequiredArgsConstructor
public class PokerMusicService {
    public static final Pattern VIDEO_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern LINK = Pattern.compile(
            "(?:youtu\\.be/|youtube(?:-nocookie)?\\.com/(?:watch\\?(?:[^\\s#]*&)?v=|shorts/|embed/|live/))([A-Za-z0-9_-]{11})");
    static final int MAX_QUEUE = 30;
    static final int MAX_PER_USER = 3;

    private final LeagueRepository leagues;
    private final UserAccountRepository users;
    private final MembershipRepository memberships;
    private final ScoreTrackerPlayerRepository players;
    private final PokerMusicRepository queue;
    private final YoutubeSearchClient youtube;

    public MusicSearch search(String email, Long leagueId, String query) {
        Long userId = account(email);
        member(leagueId, userId, false);
        String clean = query == null ? "" : query.strip().replaceAll("\\s+", " ");
        if (clean.length() < 2 || clean.length() > 200) {
            throw BusinessException.badRequest("Escribe entre 2 y 200 caracteres");
        }
        if (!youtube.isEnabled()) return new MusicSearch(false, List.of());
        var link = LINK.matcher(clean);
        boolean isLink = link.find();
        if (!isLink && clean.length() > 80) {
            throw BusinessException.badRequest("Escribe entre 2 y 80 caracteres");
        }
        var found = isLink ? youtube.lookup(link.group(1)) : youtube.search(clean);
        return new MusicSearch(true, found.stream()
                .map(track -> new app.porrapp.dto.PokerDTO.Track(track.videoId(), track.title(), track.channel()))
                .toList());
    }

    @Transactional(readOnly = true)
    public MusicQueue queue(String email, Long leagueId) {
        Long userId = account(email);
        League league = member(leagueId, userId, false);
        return view(league, userId);
    }

    @Transactional
    public MusicQueue add(String email, Long leagueId, AddTrack request) {
        Long userId = account(email);
        League league = member(leagueId, userId, true);
        if (!VIDEO_ID.matcher(request.videoId()).matches()) {
            throw BusinessException.badRequest("Canción no válida");
        }
        if (queue.countByLeagueId(leagueId) >= MAX_QUEUE) {
            throw BusinessException.conflict("La cola está llena. Espera a que suenen algunas canciones");
        }
        if (!league.canOrganize(userId) && queue.countByLeagueIdAndAddedBy(leagueId, userId) >= MAX_PER_USER) {
            throw BusinessException.conflict("Ya tienes " + MAX_PER_USER + " canciones en la cola");
        }
        if (queue.existsByLeagueIdAndVideoId(leagueId, request.videoId())) {
            throw BusinessException.conflict("Esa canción ya está en la cola");
        }
        PokerMusicItem item = new PokerMusicItem();
        item.setLeagueId(leagueId);
        item.setVideoId(request.videoId());
        item.setTitle(request.title().strip());
        item.setChannel(request.channel() == null ? "" : request.channel().strip());
        item.setAddedBy(userId);
        item.setAddedByName(players.findByLeagueIdAndUserId(leagueId, userId).map(ScoreTrackerPlayer::getName)
                .orElse("Alguien"));
        item.setCreatedAt(System.currentTimeMillis());
        queue.save(item);
        return view(league, userId);
    }

    /** Quita una canción (o pasa a la siguiente si es la que suena). Quien la pidió o el organizador; sin error si ya no está. */
    @Transactional
    public MusicQueue remove(String email, Long leagueId, Long itemId) {
        Long userId = account(email);
        League league = member(leagueId, userId, true);
        queue.findByIdAndLeagueId(itemId, leagueId).ifPresent(item -> {
            if (!league.canOrganize(userId) && !item.getAddedBy().equals(userId)) {
                throw BusinessException.forbidden("Solo puedes quitar tus canciones");
            }
            queue.delete(item);
        });
        return view(league, userId);
    }

    private MusicQueue view(League league, Long userId) {
        boolean organizer = league.canOrganize(userId);
        return new MusicQueue(organizer, youtube.isEnabled(), queue.findByLeagueIdOrderByIdAsc(league.getId()).stream()
                .map(item -> new QueuedTrack(item.getId(), item.getVideoId(), item.getTitle(), item.getChannel(),
                        item.getAddedByName(), organizer || item.getAddedBy().equals(userId)))
                .toList());
    }

    private Long account(String email) {
        return users.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado")).getId();
    }

    private League member(Long leagueId, Long userId, boolean lock) {
        if (!memberships.existsById(new Membership.MembershipId(userId, leagueId))) {
            throw BusinessException.notFound("Liga de póker no encontrada");
        }
        return (lock ? leagues.findWithLockById(leagueId) : leagues.findById(leagueId)).filter(League::isPoker)
                .orElseThrow(() -> BusinessException.notFound("Liga de póker no encontrada"));
    }
}
