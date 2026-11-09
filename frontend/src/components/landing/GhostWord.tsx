import { useCallback, useRef } from 'react';
import { useLandingMotion } from './motion';
import { useScrollProgress } from './useScrollProgress';

interface GhostWordProps {
  word: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Sección con una palabra enorme al fondo que se mueve más despacio que el contenido, como el
 * rótulo pintado en la pared detrás de un cartel.
 */
export default function GhostWord({ word, children, className = '' }: GhostWordProps) {
  const ref = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const { reduced } = useLandingMotion();
  const move = useCallback((progress: number) => {
    if (wordRef.current) wordRef.current.style.transform = `translateY(${60 - 120 * progress}px)`;
  }, []);
  useScrollProgress(ref, move, { start: 1, end: 0, enabled: !reduced });

  return (
    <section ref={ref} className={`relative overflow-hidden ${className}`}>
      <span ref={wordRef} aria-hidden="true" className="landing-ghost">
        {word}
      </span>
      <div className="relative">{children}</div>
    </section>
  );
}
