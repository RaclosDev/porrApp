import { usePokerMusic } from './usePokerMusic';
import YoutubePlayer from './YoutubePlayer';

/**
 * Música del modo TV: si los jugadores han pedido canciones, suena la cola (la reproduce la pantalla del
 * organizador, que es quien puede pasar a la siguiente). Sin cola, no se muestra nada.
 */
export default function PokerTvQueue({ leagueId }: { leagueId: string | number }) {
  const { queue, remove } = usePokerMusic(leagueId);
  const [playing, ...next] = queue?.items ?? [];
  if (!playing) return null;

  return (
    <>
      {queue?.organizer && (
        <YoutubePlayer
          key="player"
          videoId={playing.videoId}
          onDone={() => remove.mutate(playing.id)}
        />
      )}
      <div className="poker-tv-music poker-tv-queue">
        <ol className="poker-tv-carousel" aria-label="Cola de canciones">
          {[playing, ...next].map((track, index) => (
            <li key={track.id} className={index === 0 ? 'is-playing' : undefined}>
              <small>{index === 0 ? 'Sonando' : `En cola · ${index}`}</small>
              <strong>{track.title}</strong>
              <span>Pedida por {track.addedBy}</span>
            </li>
          ))}
        </ol>
        {queue?.organizer && (
          <button
            type="button"
            className="poker-tv-skip"
            disabled={remove.isPending}
            onClick={() => remove.mutate(playing.id)}
          >
            Siguiente canción
          </button>
        )}
      </div>
    </>
  );
}
