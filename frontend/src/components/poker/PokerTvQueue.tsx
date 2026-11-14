import PokerTvMusic from './PokerTvMusic';
import { usePokerMusic } from './usePokerMusic';
import YoutubePlayer from './YoutubePlayer';

/**
 * Música del modo TV: si los jugadores han pedido canciones, suena la cola (la reproduce la pantalla del
 * organizador, que es quien puede pasar a la siguiente). Sin cola, queda el enlace de YouTube o Spotify.
 */
export default function PokerTvQueue({ leagueId }: { leagueId: string | number }) {
  const { queue, remove } = usePokerMusic(leagueId);
  const [playing, ...next] = queue?.items ?? [];
  if (!playing) return <PokerTvMusic />;

  return (
    <div className="poker-tv-music poker-tv-queue">
      {queue?.organizer && (
        <YoutubePlayer
          key="player"
          videoId={playing.videoId}
          onDone={() => remove.mutate(playing.id)}
        />
      )}
      <p className="poker-tv-now">
        <span>Suena</span>
        <strong>{playing.title}</strong>
        <small>Pedida por {playing.addedBy}</small>
      </p>
      {next.length > 0 && (
        <ol aria-label="Siguientes canciones">
          {next.slice(0, 3).map((track) => (
            <li key={track.id}>
              {track.title} <small>· {track.addedBy}</small>
            </li>
          ))}
        </ol>
      )}
      {queue?.organizer && (
        <div className="poker-tv-music-actions">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(playing.id)}
          >
            Siguiente canción
          </button>
        </div>
      )}
    </div>
  );
}
