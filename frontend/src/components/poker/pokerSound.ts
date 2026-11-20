/** Avisos del reloj de póker: archivos MP3 y, si faltan o no cargan, sonidos de Web Audio. */
export type PokerSoundKind = 'level' | 'warning' | 'break' | 'rebuy' | 'addOn';

/** Efectos grabados, servidos desde `public/sounds/poker`; el resto de avisos se sintetizan. */
interface SoundFile {
  src: string;
  /** Duración máxima de cada golpe. */
  seconds: number;
  /** Segundos en los que arranca cada golpe: la bala suena dos veces, pam, pam. */
  hits?: number[];
  /** Segundo del archivo donde empieza el golpe que se usa. */
  from?: number;
}

const POKER_SOUND_FILES: Partial<Record<PokerSoundKind, SoundFile>> = {
  rebuy: { src: '/sounds/poker/rebuy.mp3', seconds: 3, hits: [0, 0.45] },
  addOn: { src: '/sounds/poker/addon.mp3', seconds: 4 },
  // De la campana de boxeo solo se usa el último golpe, el más limpio: ding, ding, ding.
  level: { src: '/sounds/poker/level.mp3', seconds: 2.5, hits: [0, 0.5, 1], from: 0.5 },
};

/** Tiempo que la música baja a la mitad para que se oiga cada aviso. */
const DUCK_MS: Record<PokerSoundKind, number> = {
  level: 4000,
  break: 3500,
  warning: 1500,
  rebuy: 2500,
  addOn: 6000,
};

/** La música tarda esto en bajar: el aviso espera a que haya bajado para sonar. */
export const POKER_DUCK_FADE_MS = 1000;

type DuckListener = (ms: number) => void;
const duckListeners = new Set<DuckListener>();

/** El reproductor de música se apunta aquí para bajar el volumen mientras suena un aviso. */
export function onPokerDuck(listener: DuckListener) {
  duckListeners.add(listener);
  return () => {
    duckListeners.delete(listener);
  };
}

const STORAGE_KEY = 'porrapp.poker.sound';

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** Los navegadores solo permiten sonar tras un gesto del usuario: se llama desde un clic o toque. */
export function unlockAudio() {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  if (ctx && typeof fetch !== 'undefined') {
    Object.values(POKER_SOUND_FILES).forEach((file) => void loadBuffer(ctx, file.src));
  }
}

export function soundEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function storeSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Sin almacenamiento: la preferencia vale solo para esta visita.
  }
}

/** Campana: parciales inarmónicos con caída exponencial, más graves cuanto más largos. */
function bell(ctx: AudioContext, start: number, frequency: number, seconds: number, gain: number) {
  const partials: [number, number][] = [
    [1, 1],
    [2.76, 0.5],
    [5.4, 0.25],
    [8.93, 0.12],
  ];
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  for (const [ratio, level] of partials) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency * ratio;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(level, start + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, start + seconds / (1 + ratio * 0.15));
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + seconds);
  }
}

function beep(ctx: AudioContext, start: number, frequency: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  osc.connect(env).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.2);
}

/** Disparo del oeste: golpe de ruido filtrado con un eco corto. */
function shot(ctx: AudioContext, start: number) {
  const seconds = 0.45;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, start);
  filter.frequency.exponentialRampToValueAtTime(400, start + seconds);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.9, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(filter).connect(env).connect(ctx.destination);
  source.start(start);
  // Golpe grave que da cuerpo al disparo.
  const thump = ctx.createOscillator();
  const thumpEnv = ctx.createGain();
  thump.frequency.setValueAtTime(140, start);
  thump.frequency.exponentialRampToValueAtTime(45, start + 0.15);
  thumpEnv.gain.setValueAtTime(0.6, start);
  thumpEnv.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  thump.connect(thumpEnv).connect(ctx.destination);
  thump.start(start);
  thump.stop(start + 0.2);
}

/** Monedas cayendo: tintineos agudos que se aceleran, como una caja registradora. */
function coins(ctx: AudioContext, start: number) {
  for (let i = 0; i < 9; i++) {
    const offset = i * 0.11 - i * i * 0.004;
    bell(ctx, start + offset, 1800 + ((i * 337) % 900), 0.5, 0.12);
  }
  bell(ctx, start + 0.85, 1046, 1.6, 0.25);
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();

/** Descarga y decodifica un efecto una sola vez; `null` si falta o no se puede leer. */
function loadBuffer(ctx: AudioContext, src: string) {
  let buffer = buffers.get(src);
  if (!buffer) {
    buffer = fetch(src)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(src))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    buffers.set(src, buffer);
  }
  return buffer;
}

export function playPokerSound(kind: PokerSoundKind) {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;
  // Con música sonando, el aviso arranca cuando ya ha bajado el volumen.
  const lead = duckListeners.size > 0 ? POKER_DUCK_FADE_MS : 0;
  const duck = (ms: number) => duckListeners.forEach((listener) => listener(lead + ms));
  const file = POKER_SOUND_FILES[kind];
  if (!file || typeof fetch === 'undefined') {
    duck(DUCK_MS[kind]);
    synth(ctx, kind, lead);
    return;
  }
  void loadBuffer(ctx, file.src).then((buffer) => {
    if (!buffer) {
      duck(DUCK_MS[kind]);
      synth(ctx, kind, lead);
      return;
    }
    const hits = file.hits ?? [0];
    const from = file.from ?? 0;
    const length = Math.min(buffer.duration - from, file.seconds);
    duck((Math.max(...hits) + length) * 1000);
    const start = ctx.currentTime + 0.02 + lead / 1000;
    hits.forEach((offset) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(start + offset, from, length);
    });
  });
}

function synth(ctx: AudioContext, kind: PokerSoundKind, lead: number) {
  const t = ctx.currentTime + 0.02 + lead / 1000;
  if (kind === 'rebuy') {
    // Pam, pam, pam: una bala más en la mesa.
    [0, 0.32, 0.64].forEach((offset) => shot(ctx, t + offset));
  } else if (kind === 'addOn') {
    coins(ctx, t);
  } else if (kind === 'level') {
    // Dos golpes de campana: suben las ciegas.
    bell(ctx, t, 520, 2.4, 0.35);
    bell(ctx, t + 0.9, 520, 2.8, 0.35);
  } else if (kind === 'break') {
    // Carillón descendente, más suave: descanso.
    [784, 659, 523].forEach((frequency, i) => bell(ctx, t + i * 0.45, frequency, 1.8, 0.22));
  } else {
    beep(ctx, t, 880);
    beep(ctx, t + 0.25, 880);
  }
}
