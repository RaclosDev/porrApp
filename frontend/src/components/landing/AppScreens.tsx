import type { PageScreens } from '../../seo/pages';

/** Tamaño real de las capturas grandes (390 × 844 a 2x, reducidas a 600 de ancho). */
const SHOT_WIDTH = 600;
const SHOT_HEIGHT = 1298;
/** En móvil cada teléfono ocupa unos dos tercios de la pantalla; en escritorio, 260 px. */
const SHOT_SIZES = '(min-width: 1024px) 260px, 64vw';

interface AppScreensProps {
  screens: PageScreens;
}

/**
 * Capturas de una liga de ejemplo dentro de marcos de móvil. En escritorio van en abanico; en móvil,
 * en una fila que se desliza de lado. Llevan anchura y altura fijas para no mover la página al cargar.
 */
export default function AppScreens({ screens }: AppScreensProps) {
  return (
    <section className="mt-14" aria-labelledby="app-screens-title">
      <h2
        id="app-screens-title"
        className="poster-title text-3xl sm:text-4xl text-white text-center"
      >
        {screens.title}
      </h2>
      <div className="app-screens">
        <ul className="app-screens-list">
          {screens.shots.map((shot) => (
            <li key={shot.src} className="app-screens-item">
              <div className="app-phone">
                <img
                  src={`${shot.src}-600.webp`}
                  srcSet={`${shot.src}-300.webp 300w, ${shot.src}-600.webp 600w`}
                  sizes={SHOT_SIZES}
                  width={SHOT_WIDTH}
                  height={SHOT_HEIGHT}
                  alt={shot.alt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-center text-sm text-[#94a3b8] mt-2">
        Capturas de PorrApp con datos de ejemplo.
      </p>
    </section>
  );
}
