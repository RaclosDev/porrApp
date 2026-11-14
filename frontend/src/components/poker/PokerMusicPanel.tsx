import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { searchMusic, type MusicTrack } from '../../services/endpoints/pokerMusic';
import { errorMessage } from '../../utils/errors';
import { usePokerMusic } from './usePokerMusic';

/** Los jugadores buscan una canción por su nombre y la añaden a la cola que suena en el modo TV. */
export default function PokerMusicPanel({ leagueId }: { leagueId: string | number }) {
  const { queue, add, remove } = usePokerMusic(leagueId);
  const [text, setText] = useState('');
  const search = useMutation({ mutationFn: (query: string) => searchMusic(leagueId, query) });
  const queued = new Set(queue?.items.map((item) => item.videoId));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = text.trim();
    if (query.length >= 2) search.mutate(query);
  };
  const pick = (track: MusicTrack) => add.mutate(track);

  return (
    <section
      className="paper-panel album-sheet poker-panel poker-music"
      aria-labelledby="poker-music-title"
    >
      <h2 id="poker-music-title">Música de la mesa</h2>
      {queue && !queue.searchAvailable ? (
        <p>La búsqueda de canciones no está disponible ahora mismo.</p>
      ) : (
        <form onSubmit={submit} role="search" className="poker-music-search">
          <label>
            <span className="sr-only">Buscar canción</span>
            <input
              type="search"
              value={text}
              maxLength={80}
              placeholder="Busca una canción: shakira loba…"
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="glass-btn"
            disabled={search.isPending || text.trim().length < 2}
          >
            Buscar
          </button>
        </form>
      )}
      {search.isError && <p role="alert">{errorMessage(search.error, 'No se pudo buscar.')}</p>}
      {search.data && search.data.results.length === 0 && (
        <p>No hay resultados. Prueba con otro nombre.</p>
      )}
      {search.data && search.data.results.length > 0 && (
        <ul className="poker-music-results" aria-label="Resultados">
          {search.data.results.map((track) => (
            <li key={track.videoId}>
              <img
                src={`https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`}
                alt=""
                width="80"
                height="45"
                loading="lazy"
              />
              <span>
                <strong>{track.title}</strong>
                <small>{track.channel}</small>
              </span>
              <button
                type="button"
                className="glass-btn"
                disabled={add.isPending || queued.has(track.videoId)}
                onClick={() => pick(track)}
              >
                {queued.has(track.videoId) ? 'En la cola' : 'Añadir'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {queue && queue.items.length > 0 && (
        <>
          <h3>En la cola</h3>
          <ol className="poker-music-queue">
            {queue.items.map((item, index) => (
              <li key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {index === 0 ? 'Sonando · ' : ''}
                    {item.addedBy}
                  </small>
                </span>
                {item.removable && (
                  <button
                    type="button"
                    className="glass-btn"
                    aria-label={`Quitar ${item.title}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
