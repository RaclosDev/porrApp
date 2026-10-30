import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useLandingMotion } from './motion';

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
  const { reduced } = useLandingMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.span aria-hidden="true" className="landing-ghost" style={reduced ? undefined : { y }}>
        {word}
      </motion.span>
      <div className="relative">{children}</div>
    </section>
  );
}
