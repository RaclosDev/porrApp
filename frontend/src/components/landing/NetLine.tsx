import { useCallback, useRef } from 'react';
import { useLandingMotion } from './motion';
import { useScrollProgress } from './useScrollProgress';

/**
 * Red de portería que se va tejiendo con el scroll entre dos secciones. Sustituye al alambre
 * de los carteles callejeros: separa las secciones y marca que la página sigue hacia abajo.
 */
export default function NetLine() {
  const ref = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const { reduced } = useLandingMotion();
  const draw = useCallback((progress: number) => {
    pathRef.current?.style.setProperty('stroke-dasharray', `${progress} 1`);
  }, []);
  useScrollProgress(ref, draw, { start: 0.95, end: 0.45, enabled: !reduced });

  const rows = [0, 14, 28];
  const path = rows
    .map((y, i) =>
      i % 2 === 0 ? `M0 ${y + 6} ${wave(y + 6)}` : `M1000 ${y + 6} ${wave(y + 6, true)}`,
    )
    .join(' ');

  return (
    <div ref={ref} className="landing-net" aria-hidden="true">
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="w-full h-10 block">
        <path
          ref={pathRef}
          d={path}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={reduced ? undefined : { strokeDasharray: '0 1' }}
        />
      </svg>
    </div>
  );
}

/** Una fila de malla: rombos de 40 px a lo ancho, de izquierda a derecha o al revés. */
function wave(y: number, reverse = false): string {
  const steps: string[] = [];
  for (let x = 0; x <= 1000; x += 40) {
    const px = reverse ? 1000 - x : x;
    const mid = reverse ? px - 20 : px + 20;
    if (x < 1000) steps.push(`L${mid} ${y - 6} L${reverse ? px - 40 : px + 40} ${y + 6}`);
  }
  return steps.join(' ');
}
