import { useEffect, useId, useRef } from 'react';
import { crupierMarkup, type CrupierHat } from './crupierArt';
import { CrupierEngine, type CrupierAction } from './crupierEngine';
import './crupier.css';

/** Orden de hacer una acción; con `audioDelay`, su golpe cae cuando suena el aviso, esos segundos después. */
export interface CrupierCue {
  id: number | string;
  action: CrupierAction;
  audioDelay?: number;
}

interface CrupierProps {
  hat?: CrupierHat;
  /** Se echa a dormir (descanso del torneo) y se despierta al quitarlo. */
  asleep?: boolean;
  cue?: CrupierCue | null;
  /** Hace gestos al azar mientras no hay nada que anunciar. */
  auto?: boolean;
  /** Sin pared, viñeta ni marco: el fondo lo pone quien lo contiene y la mesa se alarga hasta sus bordes. */
  bare?: boolean;
  /** Sujeta con las dos manos un cartel que se pinta delante, a partir del 74 % de su alto. */
  holding?: boolean;
  className?: string;
}

const seconds = () => performance.now() / 1000;
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

/** El crupier de PorrApp, animado. Es decorativo: lo que anuncia ya está escrito al lado. */
export function Crupier({
  hat = 'verde',
  asleep = false,
  cue = null,
  auto = true,
  bare = false,
  holding = false,
  className,
}: CrupierProps) {
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<CrupierEngine | null>(null);
  const suffix = useId().replace(/[^a-zA-Z0-9]/g, '');
  const state = useRef({ asleep, auto, cue, holding });
  useEffect(() => {
    state.current = { asleep, auto, cue, holding };
  });

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    node.innerHTML = crupierMarkup(suffix, hat);
    const svg = node.querySelector('svg');
    if (!svg) return;
    const still = reducedMotion();
    const crupier = new CrupierEngine(svg, seconds(), state.current.auto, still);
    crupier.setAsleep(state.current.asleep, seconds());
    crupier.holding = state.current.holding;
    engine.current = crupier;
    crupier.frame(seconds());
    if (still || typeof requestAnimationFrame === 'undefined') {
      return () => {
        engine.current = null;
      };
    }
    // Fuera de la vista o con la pestaña oculta no se anima: cada fotograma toca el SVG y no
    // tiene sentido gastar batería en algo que no se ve.
    let raf = 0;
    let onScreen = true;
    const tick = () => {
      crupier.frame(seconds());
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      const run = onScreen && document.visibilityState !== 'hidden';
      if (run && !raf) raf = requestAnimationFrame(tick);
      if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true;
            sync();
          });
    observer?.observe(node);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      engine.current = null;
    };
  }, [hat, suffix]);

  useEffect(() => {
    const crupier = engine.current;
    if (!crupier) return;
    crupier.setAsleep(asleep, seconds());
  }, [asleep]);

  useEffect(() => {
    if (engine.current) engine.current.auto = auto;
  }, [auto]);

  useEffect(() => {
    if (engine.current) engine.current.holding = holding;
  }, [holding]);

  // Solo cuenta un aviso nuevo, no cada render con el mismo.
  const cueId = cue?.id;
  useEffect(() => {
    const crupier = engine.current;
    const next = state.current.cue;
    if (!crupier || !next || cueId === undefined) return;
    const now = seconds();
    crupier.play(
      next.action,
      now,
      next.audioDelay === undefined ? undefined : now + next.audioDelay,
    );
  }, [cueId]);

  // Después de la siesta y del aviso a la vez: un aviso que llega con el descanso no deja que se duerma antes.
  useEffect(() => {
    engine.current?.frame(seconds());
  }, [asleep, cueId]);

  return (
    <div
      ref={box}
      className={['crupier', bare && 'crupier-bare', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}
