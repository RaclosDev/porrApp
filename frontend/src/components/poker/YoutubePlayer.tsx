import { useEffect, useRef } from 'react';
import { onPokerDuck, POKER_DUCK_FADE_MS, POKER_DUCK_LEVEL } from './pokerSound';

/** La música vuelve a su volumen en este tiempo, más despacio de lo que baja. */
const FADE_UP_MS = 2000;
const FADE_STEP_MS = 100;

interface YtPlayer {
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
  getVolume?: () => number;
  setVolume?: (volume: number) => void;
}

interface YtApi {
  Player: new (
    element: HTMLElement,
    options: {
      host: string;
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady: (event: { target: { playVideo: () => void } }) => void;
        onStateChange: (event: { data: number }) => void;
        onError: () => void;
      };
    },
  ) => YtPlayer;
}

type YtWindow = Window & { YT?: YtApi; onYouTubeIframeAPIReady?: () => void };

const ENDED = 0;
let apiReady: Promise<YtApi> | null = null;

/** Carga una sola vez la API de reproductor de YouTube, que avisa de cuándo acaba cada vídeo. */
function loadApi(): Promise<YtApi> {
  const ytWindow = window as YtWindow;
  if (ytWindow.YT?.Player) return Promise.resolve(ytWindow.YT);
  apiReady ??= new Promise<YtApi>((resolve, reject) => {
    ytWindow.onYouTubeIframeAPIReady = () => {
      if (ytWindow.YT) resolve(ytWindow.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      apiReady = null;
      reject(new Error('No se pudo cargar el reproductor de YouTube'));
    };
    document.head.append(script);
  });
  return apiReady;
}

interface Props {
  videoId: string;
  /** Acaba el vídeo o no se puede reproducir: toca pasar a la siguiente canción. */
  onDone: () => void;
}

/** Reproductor de un vídeo de YouTube que empieza solo y avisa al terminar. */
export default function YoutubePlayer({ videoId, onDone }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YtPlayer | null>(null);
  const doneRef = useRef(onDone);
  const current = useRef(videoId);
  useEffect(() => {
    doneRef.current = onDone;
    current.current = videoId;
  }, [onDone, videoId]);

  useEffect(() => {
    let cancelled = false;
    const mount = document.createElement('div');
    const container = host.current;
    container?.append(mount);
    void loadApi()
      .then((yt) => {
        if (cancelled) return;
        player.current = new yt.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          videoId: current.current,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, cc_load_policy: 0, iv_load_policy: 3 },
          events: {
            onReady: (event) => {
              // Nunca subtítulos, aunque la cuenta de YouTube los tenga activados.
              const target = event.target as { unloadModule?: (name: string) => void };
              target.unloadModule?.('captions');
              target.unloadModule?.('cc');
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === ENDED) doneRef.current();
            },
            onError: () => doneRef.current(),
          },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      container?.replaceChildren();
    };
  }, []);

  useEffect(() => {
    player.current?.loadVideoById(videoId);
  }, [videoId]);

  // Durante un aviso la música baja poco a poco hasta casi callarse y, al acabar, vuelve a subir despacio.
  useEffect(() => {
    let base: number | null = null;
    let current = 0;
    let fade: number | undefined;
    let restore: number | undefined;
    const ramp = (to: number, ms: number, done?: () => void) => {
      window.clearInterval(fade);
      const from = current;
      const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
      let step = 0;
      fade = window.setInterval(() => {
        step += 1;
        current = from + ((to - from) * step) / steps;
        player.current?.setVolume?.(Math.round(current));
        if (step >= steps) {
          window.clearInterval(fade);
          done?.();
        }
      }, FADE_STEP_MS);
    };
    const unsubscribe = onPokerDuck((ms) => {
      const active = player.current;
      if (!active?.setVolume) return;
      if (base === null) {
        base = active.getVolume?.() ?? 100;
        current = base;
      }
      ramp(base * POKER_DUCK_LEVEL, POKER_DUCK_FADE_MS);
      window.clearTimeout(restore);
      restore = window.setTimeout(() => {
        if (base !== null)
          ramp(base, FADE_UP_MS, () => {
            base = null;
          });
      }, ms);
    });
    return () => {
      unsubscribe();
      window.clearInterval(fade);
      window.clearTimeout(restore);
      if (base !== null) player.current?.setVolume?.(base);
    };
  }, []);

  return <div ref={host} className="poker-tv-video" />;
}
