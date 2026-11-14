export interface MusicEmbed {
  src: string;
  height: number;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);
const SPOTIFY_KINDS = new Set(['playlist', 'album', 'track', 'episode', 'show', 'artist']);
const ID = /^[\w-]{1,64}$/;
const STORAGE_KEY = 'poker-tv-music';

/** Convierte un enlace de YouTube o Spotify en la dirección del reproductor incrustado. */
export function musicEmbed(input: string): MusicEmbed | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const video = url.pathname.slice(1);
    const list = url.searchParams.get('list');
    if (!ID.test(video)) return null;
    return youtube(video, list);
  }
  if (YOUTUBE_HOSTS.has(host)) {
    const list = url.searchParams.get('list');
    const video = url.searchParams.get('v');
    if (video && ID.test(video)) return youtube(video, list);
    if (list && ID.test(list)) return youtube(null, list);
    return null;
  }
  if (host === 'open.spotify.com') {
    const [kind, id] = url.pathname
      .split('/')
      .filter(Boolean)
      .filter((part) => !part.startsWith('intl-'));
    if (!SPOTIFY_KINDS.has(kind) || !ID.test(id ?? '')) return null;
    return { src: `https://open.spotify.com/embed/${kind}/${id}`, height: 152 };
  }
  return null;
}

function youtube(video: string | null, list: string | null): MusicEmbed | null {
  if (list && !ID.test(list)) return null;
  const base = 'https://www.youtube-nocookie.com/embed/';
  const params = new URLSearchParams({ autoplay: '1' });
  if (video) {
    if (list) params.set('list', list);
    return { src: `${base}${video}?${params}`, height: 152 };
  }
  params.set('list', list ?? '');
  return { src: `${base}videoseries?${params}`, height: 152 };
}

export const storedMusic = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

export const storeMusic = (link: string) => {
  try {
    if (link) localStorage.setItem(STORAGE_KEY, link);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento disponible: la música solo dura mientras el modo TV está abierto.
  }
};
