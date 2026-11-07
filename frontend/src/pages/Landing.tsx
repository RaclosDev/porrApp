import { Skeleton } from '../components/SkeletonBlock';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import MarkerHeading from '../components/landing/MarkerHeading';
import StickerCard from '../components/StickerCard';
import NetLine from '../components/landing/NetLine';
import GhostWord from '../components/landing/GhostWord';
import FixtureSheet from '../components/landing/FixtureSheet';
import {
  fanContainer,
  fanItem,
  inViewOnce,
  rise,
  useLandingMotion,
} from '../components/landing/motion';
import { useLandingData } from '../hooks/useLandingData';
import SiteFooter from '../components/landing/SiteFooter';
import { LANDING_COPY } from '../seo/pages';

const FAN_ANGLES = [-8, -3, 0, 3, 8];
/** Ancho real de las capturas: media columna en escritorio, casi toda la pantalla en el móvil. */
const SCREENSHOT_SIZES = '(min-width: 1024px) 560px, calc(100vw - 80px)';

/**
 * Portada para quien aún no ha entrado: un cartel con la porra real del Mundial, los cromos de
 * los primeros de la liga pública destacada y los dos formatos de liga.
 */
export default function Landing() {
  const { reduced, visible } = useLandingMotion();
  const { leaders, leagueName, participants, champion, nextFixtures, loading, error } =
    useLandingData();
  const leagueLabel = leagueName ?? 'la liga pública';
  const openLogin = () => window.dispatchEvent(new CustomEvent('open-login-modal'));
  const leader = leaders[0];
  const initial = reduced ? 'show' : 'hidden';

  return (
    <div className="landing-page max-w-300 my-0 mx-auto pt-4 pb-15 px-4">
      <section className="landing-poster landing-tape mt-6 px-6 py-10 sm:px-10 sm:py-14 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div className="flex flex-col gap-6">
          <MarkerHeading
            as="h1"
            onLoad
            text={LANDING_COPY.h1}
            marked={LANDING_COPY.h1Marked}
            className="text-[clamp(2.6rem,7vw,5.5rem)]"
          />
          {/* Sin fundido: es el elemento más grande de la primera pantalla (LCP) y debe pintarse ya. */}
          <p className="text-[#1f2937] text-lg max-w-130 leading-snug">{LANDING_COPY.lede}</p>
          <motion.div
            variants={rise}
            initial={initial}
            animate={visible ? 'show' : undefined}
            className="flex flex-wrap gap-3"
          >
            <button
              id="btn-hero-login"
              type="button"
              onClick={openLogin}
              className="landing-btn landing-btn-ink"
            >
              Entrar con Google
            </button>
            <Link to="/demo" className="landing-btn">
              Ver la porra del Mundial
            </Link>
          </motion.div>
        </div>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 40, rotate: 0 }}
          animate={visible ? { opacity: 1, y: 0, rotate: 0 } : undefined}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="landing-hero-podium min-w-0 w-full justify-self-center"
        >
          {leader ? (
            <div>
              <ul className="ranking-podium" aria-label={`Podio de ${leagueLabel}`}>
                {leaders.slice(0, 3).map((row) => (
                  <li
                    key={row.userId ?? row.name}
                    className={`ranking-podium-place ranking-podium-place-${row.rank}`}
                  >
                    <StickerCard leader={row} featured={row.rank === 1} compact />
                  </li>
                ))}
              </ul>
              <p className="text-[#4b5563] text-sm text-center">
                Va primero de {participants} en {leagueLabel}
              </p>
            </div>
          ) : loading && !error ? (
            <div
              role="status"
              aria-label="Cargando clasificación"
              aria-busy="true"
              className="flex items-end justify-center gap-3 p-4"
            >
              <Skeleton width="30%" height={150} radius={4} />
              <Skeleton width="34%" height={190} radius={4} />
              <Skeleton width="30%" height={130} radius={4} />
            </div>
          ) : (
            <p className="text-[#4b5563] text-sm" role="status">
              {error
                ? 'La clasificación no responde ahora mismo.'
                : `Todavía no hay cuadros en ${leagueLabel}.`}
            </p>
          )}
        </motion.div>
      </section>

      <NetLine />

      <GhostWord word="Álbum" className="py-10">
        <MarkerHeading
          text={`Los cromos de ${leagueLabel}`}
          className="text-[clamp(2rem,5vw,3.6rem)] text-white"
        />
        {leaders.length === 0 && loading && !error ? (
          // Mismo alto que el álbum: al llegar los cromos la página no crece de golpe.
          <div className="landing-sticker-album-slot mt-10" aria-hidden="true" />
        ) : null}
        {leaders.length > 0 ? (
          <motion.ul
            variants={fanContainer}
            initial={initial}
            whileInView={visible ? 'show' : undefined}
            viewport={inViewOnce}
            className="landing-sticker-album mt-10 list-none"
            aria-label={`Cromos de ${leagueLabel}`}
            tabIndex={0}
          >
            {leaders.map((row, index) => (
              <motion.li
                key={row.userId ?? row.name}
                variants={fanItem(FAN_ANGLES[index] ?? 0)}
                className="lg:-ml-6 lg:first:ml-0"
              >
                <StickerCard leader={row} />
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
        <motion.div
          variants={rise}
          initial={initial}
          whileInView={visible ? 'show' : undefined}
          viewport={inViewOnce}
          className="mt-10 flex flex-wrap items-center justify-center gap-6"
        >
          {champion ? (
            <span className="ink-stamp ink-stamp-paper">
              {champion.team} campeona en {champion.count} de {champion.total} cuadros
            </span>
          ) : null}
          <Link to="/demo" className="landing-link-light">
            Ver la clasificación completa
          </Link>
        </motion.div>
      </GhostWord>

      <NetLine />

      <GhostWord word="Formatos" className="py-10">
        <MarkerHeading
          text="Dos formas de jugar"
          className="text-[clamp(2rem,5vw,3.6rem)] text-white"
        />
        <div className="grid gap-8 lg:grid-cols-2 mt-10 items-start">
          <motion.article
            variants={rise}
            initial={initial}
            whileInView={visible ? 'show' : undefined}
            viewport={inViewOnce}
            className="landing-poster landing-tape rotate-1 p-6 sm:p-8 flex flex-col gap-4"
          >
            <h3 className="poster-title text-4xl">{LANDING_COPY.bracketTitle}</h3>
            <p className="text-[#1f2937] leading-snug">{LANDING_COPY.bracketText}</p>
            <img
              src="/landing/cuadro-1200.webp"
              srcSet="/landing/cuadro-640.webp 640w, /landing/cuadro-1200.webp 1200w"
              sizes={SCREENSHOT_SIZES}
              alt="El cuadro del Mundial 2026 en PorrApp: de dieciseisavos a la final, con España campeona."
              loading="lazy"
              width="1200"
              height="812"
              className="w-full h-auto rounded-md border border-[rgba(17,24,39,0.2)]"
            />
            <Link to="/demo" className="landing-link self-start">
              Abrir la porra del Mundial
            </Link>
          </motion.article>

          <motion.article
            variants={rise}
            initial={initial}
            whileInView={visible ? 'show' : undefined}
            viewport={inViewOnce}
            className="landing-poster landing-tape p-6 sm:p-8 flex flex-col gap-4"
          >
            <h3 className="poster-title text-4xl">{LANDING_COPY.matchdayTitle}</h3>
            <p className="text-[#1f2937] leading-snug">{LANDING_COPY.matchdayText}</p>
            <figure className="m-0">
              <img
                src="/landing/jornadas-1080.webp"
                srcSet="/landing/jornadas-640.webp 640w, /landing/jornadas-1080.webp 1080w"
                sizes={SCREENSHOT_SIZES}
                alt="Inicio de una liga por jornadas: partidos, clasificación de participantes y tabla de LaLiga."
                loading="lazy"
                width="1080"
                height="706"
                className="w-full h-auto rounded-md border border-[rgba(17,24,39,0.2)]"
              />
              <figcaption className="text-sm text-[#374151] mt-2">
                Ejemplo del inicio de una liga por jornadas con datos de demostración.
              </figcaption>
            </figure>
            <FixtureSheet fixtures={nextFixtures} onPick={openLogin} />
          </motion.article>
        </div>
        <p className="text-muted text-sm text-center mt-8">{LANDING_COPY.closing}</p>
      </GhostWord>

      <SiteFooter />
    </div>
  );
}
