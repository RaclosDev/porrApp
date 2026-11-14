import { useState } from 'react';
import { musicEmbed, storedMusic, storeMusic } from './pokerMusic';

/** Música de fondo del modo TV: se pega un enlace de YouTube o Spotify (vídeo, álbum o lista). */
export default function PokerTvMusic() {
  const [link, setLink] = useState(storedMusic);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const embed = musicEmbed(link);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    if (!musicEmbed(draft)) {
      setError(true);
      return;
    }
    setError(false);
    setLink(draft.trim());
    storeMusic(draft.trim());
    setDraft('');
    setOpen(false);
  };

  const clear = () => {
    setLink('');
    storeMusic('');
    setOpen(true);
  };

  return (
    <div className="poker-tv-music">
      {embed && (
        <iframe
          title="Música del torneo"
          src={embed.src}
          height={embed.height}
          allow="autoplay; encrypted-media; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      {(open || !embed) && (
        <form onSubmit={save}>
          <label>
            <span>Música: enlace de YouTube o Spotify</span>
            <input
              type="url"
              value={draft}
              placeholder="https://…"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <button type="submit">Poner</button>
          {error && <p role="alert">Solo enlaces de YouTube o Spotify.</p>}
        </form>
      )}
      {embed && (
        <div className="poker-tv-music-actions">
          <button type="button" onClick={() => setOpen((value) => !value)}>
            Cambiar
          </button>
          <button type="button" onClick={clear}>
            Quitar
          </button>
        </div>
      )}
    </div>
  );
}
