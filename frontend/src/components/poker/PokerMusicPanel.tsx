import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { searchMusic, type MusicTrack } from '../../services/endpoints/pokerMusic';
import DialogBackdrop from '../DialogBackdrop';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { errorMessage } from '../../utils/errors';
import { usePokerMusic } from './usePokerMusic';

/** Los jugadores buscan una canción por su nombre y la añaden a la cola que suena en el modo TV. */
export default function PokerMusicPanel({ leagueId }: { leagueId: string | number }) {
  const { queue, add, remove } = usePokerMusic(leagueId);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { active: open, onEscape: () => setOpen(false) });
  const search = useMutation({ mutationFn: (query: string) => searchMusic(leagueId, query) });
  const queued = new Set(queue?.items.map((item) => item.videoId));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = text.trim();
    if (query.length >= 2) search.mutate(query);
  };
  const pick = (track: MusicTrack) => add.mutate(track);

  const playing = queue?.items[0];
  const waiting = queue ? queue.items.length - 1 : 0;

  return (
    <section
      className="paper-panel album-sheet poker-panel poker-music"
      aria-labelledby="poker-music-title"
    >
      <h2 id="poker-music-title">Música de la mesa</h2>
      {queue && !queue.searchAvailable ? (
        <p>La búsqueda de canciones no está disponible ahora mismo.</p>
      ) : (
        <button type="button" className="glass-btn" onClick={() => setOpen(true)}>
          Añadir canción
        </button>
      )}
      {playing && (
        <p className="poker-music-now">
          <small>Sonando · {playing.addedBy}</small>
          <strong>{playing.title}</strong>
        </p>
      )}
      {waiting > 0 && queue && (
        <>
          <button
            type="button"
            className="poker-music-toggle"
            aria-expanded={showQueue}
            onClick={() => setShowQueue(!showQueue)}
          >
            {showQueue ? 'Ocultar la cola' : `Ver la cola (${waiting} más)`}
          </button>
          {showQueue && (
            <ol className="poker-music-queue" start={2}>
              {queue.items.slice(1).map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.addedBy}</small>
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
          )}
        </>
      )}
      {open &&
        createPortal(
          <DialogBackdrop className="paper-dialog-overlay" onDismiss={() => setOpen(false)}>
            <div
              ref={dialogRef}
              tabIndex={-1}
              className="paper-panel paper-dialog poker-music-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="poker-music-dialog-title"
            >
              <h2 id="poker-music-dialog-title">Añadir canción</h2>
              <form onSubmit={submit} role="search" className="poker-music-search">
                <label>
                  <span className="sr-only">Buscar canción o pegar enlace de YouTube</span>
                  <input
                    type="search"
                    value={text}
                    maxLength={200}
                    placeholder="Nombre de la canción o enlace de YouTube"
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
              {search.isError && (
                <p role="alert">{errorMessage(search.error, 'No se pudo buscar.')}</p>
              )}
              {add.isError && <p role="alert">{errorMessage(add.error, 'No se pudo añadir.')}</p>}
              {search.data && search.data.results.length === 0 && (
                <p>
                  No hay resultados (si es un enlace, puede que el vídeo no se pueda reproducir
                  aquí). Prueba con otro.
                </p>
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
              <button type="button" className="glass-btn" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
          </DialogBackdrop>,
          document.body,
        )}
    </section>
  );
}
