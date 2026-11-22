import { useEffect, useRef, useState } from 'react';
import MarkerHeading from './MarkerHeading';
import Reveal from './Reveal';
import { LANDING_COPY } from '../../seo/pages';

const START = '/demo';
const POSTER = '/landing/porras/mundial-inicio';
const DESKTOP = '(min-width: 1024px)';

// La /demo de verdad, dentro de un móvil. Hasta que se acerca a la pantalla (y siempre en móviles y tabletas)
// el móvil enseña una captura de la misma pantalla; en el ordenador la app carga detrás y aparece cuando ya se ha
// pintado. En el móvil va un botón: allí la demo a pantalla completa ya tiene tamaño de móvil.
export default function LandingLiveDemo() {
  const phone = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setDesktop(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = phone.current;
    if (!desktop || near || !el) return;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [desktop, near]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Se enseña cuando la app ya ha quitado su pantalla de carga, no la página en blanco de antes.
  const waitForApp = (frame: HTMLIFrameElement, tries = 0) => {
    const doc = frame.contentDocument;
    const painted =
      doc && !doc.getElementById('app-splash') && doc.getElementById('root')?.childElementCount;
    if (painted || tries >= 50) {
      timer.current = window.setTimeout(() => setReady(true), 200);
      return;
    }
    timer.current = window.setTimeout(() => waitForApp(frame, tries + 1), 120);
  };

  const live = desktop && near;

  return (
    <section
      id="demo-en-vivo"
      className="py-10 scroll-mt-4 grid items-center gap-10 lg:grid-cols-2"
      aria-labelledby="live-demo-title"
    >
      <div>
        <MarkerHeading
          id="live-demo-title"
          text={LANDING_COPY.liveTitle}
          marked={LANDING_COPY.liveMarked}
          className="fam-h2"
        />
        <Reveal className="mt-4 flex flex-col items-start gap-6">
          <p className="max-w-[46ch] text-lg">{LANDING_COPY.liveText}</p>
          <a href={START} className="fam-btn">
            {desktop ? 'Abrir a pantalla completa' : 'Abrir la demo'}
          </a>
        </Reveal>
      </div>

      <div className="flex justify-center">
        <div ref={phone} className="app-phone landing-live">
          <div className="landing-live__screen">
            <img
              src={`${POSTER}-300.webp`}
              srcSet={`${POSTER}-300.webp 300w, ${POSTER}-600.webp 600w`}
              sizes="390px"
              alt={
                live ? '' : 'Inicio de la demo: el podio de la porra del Mundial y tu puesto final'
              }
              width="600"
              height="1298"
              loading="lazy"
              className="landing-live__poster"
            />
            {!desktop && (
              // En el móvil la captura también abre la demo; el botón de al lado es la entrada accesible.
              <a href={START} className="absolute inset-0" tabIndex={-1} aria-hidden="true">
                <span className="sr-only">Abrir la demo</span>
              </a>
            )}
            {live && (
              <iframe
                src={START}
                title="Demo de PorrApp"
                className={`landing-live__frame${ready ? ' is-ready' : ''}`}
                onLoad={(e) => waitForApp(e.currentTarget)}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
