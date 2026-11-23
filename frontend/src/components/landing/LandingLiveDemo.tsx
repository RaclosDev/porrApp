import { useEffect, useRef, useState } from 'react';

const START = '/demo';
const POSTER = '/landing/porras/laliga-inicio';
const DESKTOP = '(min-width: 1024px)';

// Ancho real en puntos de la pantalla de un iPhone 17 (402 × 874): la app se pinta a ese tamaño y se escala.
const IPHONE_W = 402;

// La /demo de verdad, dentro de un móvil, al lado del texto del hero. En el ordenador la app carga desde el
// principio, sin una captura delante que luego haya que cambiar por ella. En móviles y tabletas el móvil enseña una
// captura de la misma pantalla que abre la demo: allí a pantalla completa ya es de móvil.
export default function LandingLiveDemo() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setDesktop(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // La app ve un iPhone 17 de verdad (402 px de ancho) y aquí se reduce al tamaño del móvil dibujado.
  const screen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = screen.current;
    if (!el || !desktop) return;
    const fit = () => el.style.setProperty('--live-scale', String(el.clientWidth / IPHONE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [desktop]);

  return (
    <figure className="landing-live-wrap">
      <div className="app-phone landing-live">
        <div ref={screen} className="landing-live__screen">
          {desktop ? (
            <iframe src={START} title="Demo de PorrApp" className="landing-live__frame" />
          ) : (
            <>
              <img
                src={`${POSTER}-300.webp`}
                srcSet={`${POSTER}-300.webp 300w, ${POSTER}-600.webp 600w`}
                sizes="390px"
                alt="Inicio de la demo: la porra de LaLiga con los partidos de la jornada en curso"
                width="600"
                height="1298"
                fetchPriority="high"
                className="landing-live__poster"
              />
              {/* En el móvil la captura también abre la demo; «Probar la demo», al lado, es la entrada accesible. */}
              <a href={START} className="absolute inset-0" tabIndex={-1} aria-hidden="true">
                <span className="sr-only">Abrir la demo</span>
              </a>
            </>
          )}
        </div>
      </div>
    </figure>
  );
}
