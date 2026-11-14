import { useEffect, useRef } from 'react';

interface YtPlayer {
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
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
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: (event) => event.target.playVideo(),
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

  return <div ref={host} className="poker-tv-video" />;
}
