import type { PageScreens } from '../../seo/pages';

/** Tamaño real de las capturas grandes (402 × 870, el ancho de un iPhone 17, a 2x y reducidas a 600 de ancho). */
const SHOT_WIDTH = 600;
const SHOT_HEIGHT = 1298;
/** En móvil cada teléfono ocupa unos dos tercios de la pantalla; en escritorio, 260 px. */
const SHOT_SIZES = '(min-width: 1024px) 260px, 64vw';
/** En la portada el abanico cabe en media columna: teléfonos de unos 200 px. */
const HERO_SHOT_SIZES = '(min-width: 1024px) 200px, 64vw';

interface AppScreensProps {
  screens: PageScreens;
  /** Junto al titular de la portada: abanico más pequeño, sin título a la vista en escritorio. */
  hero?: boolean;
}

/**
 * Capturas de la app con partidos reales dentro de marcos de móvil. En escritorio van en abanico; en móvil,
 * en una fila que se desliza de lado. Llevan anchura y altura fijas para no mover la página al cargar.
 */
export default function AppScreens({ screens, hero = false }: AppScreensProps) {
  return (
    <section className={hero ? 'mt-4 lg:mt-0' : 'mt-14'} aria-labelledby="app-screens-title">
      <h2
        id="app-screens-title"
        className={`poster-title text-3xl sm:text-4xl text-center${hero ? ' lg:sr-only' : ''}`}
      >
        {screens.title}
      </h2>
      <div className={hero ? 'app-screens app-screens-hero' : 'app-screens'}>
        <ul className="app-screens-list">
          {screens.shots.map((shot) => (
            <li key={shot.src} className="app-screens-item">
              <div className="app-phone">
                <img
                  src={`${shot.src}-600.webp`}
                  srcSet={`${shot.src}-300.webp 300w, ${shot.src}-600.webp 600w`}
                  sizes={hero ? HERO_SHOT_SIZES : SHOT_SIZES}
                  width={SHOT_WIDTH}
                  height={SHOT_HEIGHT}
                  alt={shot.alt}
                  loading={hero ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-center text-sm text-[#48505c] mt-2">
        Capturas reales de PorrApp; los participantes de la liga son de ejemplo.
      </p>
    </section>
  );
}
