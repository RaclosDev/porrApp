/** Sonidos del reloj de póker generados con Web Audio: sin archivos ni licencias. */
export type PokerSoundKind = 'level' | 'warning' | 'break';

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

export function playPokerSound(kind: PokerSoundKind) {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.02;
  if (kind === 'level') {
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
