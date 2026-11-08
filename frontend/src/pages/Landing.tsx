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
import { openSignupToCreateLeague } from '../utils/loginModal';

const FAN_ANGLES = [-8, -3, 0, 3, 8];

/** Ancho real de las capturas: media columna en escritorio, casi toda la pantalla en el móvil. */
/** El cuadro se recorta y se pinta al 180 % de su marco. */
const BRACKET_CROP_SIZES = '(min-width: 1024px) 1000px, 160vw';
const SCREENSHOT_SIZES = '(min-width: 1024px) 560px, calc(100vw - 80px)';

/**
 * Portada para quien aún no ha entrado: qué es y cómo se juega, los dos formatos de liga, los
 * cromos de los primeros de la liga pública destacada y una última llamada a crear la liga.
 */
export default function Landing() {
  const { reduced, visible } = useLandingMotion();
  const { leaders, leagueName, participants, champion, nextFixtures, loading, error } =
    useLandingData();
  const leagueLabel = leagueName ?? 'la liga pública';
  const openLogin = openSignupToCreateLeague;
  const leader = leaders[0];
  const initial = reduced ? 'show' : 'hidden';
  const inView = {
    initial,
    whileInView: visible ? 'show' : undefined,
    viewport: inViewOnce,
  } as const;

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
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap gap-3">
              <button
                id="btn-hero-login"
                type="button"
                onClick={openLogin}
                className="landing-btn landing-btn-ink"
              >
                Crear mi liga gratis
              </button>
              <Link to="/demo" className="landing-btn">
                Ver una porra de ejemplo
              </Link>
            </div>
            <p className="text-[#4b5563] text-sm">{LANDING_COPY.heroNote}</p>
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

      <GhostWord word="Cómo" className="py-10">
        <MarkerHeading
          text={LANDING_COPY.stepsTitle}
          className="text-[clamp(2rem,5vw,3.6rem)] text-white"
        />
        <motion.ol
          variants={fanContainer}
          {...inView}
          className="grid gap-6 md:grid-cols-3 mt-10 list-none p-0"
          aria-label="Pasos para jugar"
        >
          {LANDING_COPY.steps.map((step, index) => (
            <motion.li
              key={step.title}
              variants={rise}
              className="landing-poster p-6 flex flex-col gap-3"
            >
              <span className="poster-title text-5xl text-[#0b5f74]" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="poster-title text-3xl">{step.title}</h3>
              <p className="text-[#1f2937] leading-snug">{step.text}</p>
            </motion.li>
          ))}
        </motion.ol>
      </GhostWord>

      <NetLine />

      <GhostWord word="Formatos" className="py-10">
        <MarkerHeading
          text={LANDING_COPY.formatsTitle}
          className="text-[clamp(2rem,5vw,3.6rem)] text-white"
        />
        <div className="grid gap-8 lg:grid-cols-2 mt-10 items-start">
          <motion.article
            variants={rise}
            {...inView}
            className="landing-poster landing-tape rotate-1 p-6 sm:p-8 flex flex-col gap-4"
          >
            <h3 className="poster-title text-4xl">{LANDING_COPY.bracketTitle}</h3>
            <p className="text-[#1f2937] leading-snug">{LANDING_COPY.bracketText}</p>
            {/* Solo la parte central del cuadro, para que los cruces y la final se lean. */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-[rgba(17,24,39,0.2)]">
              <img
                src="/landing/cuadro-1200.webp"
                srcSet="/landing/cuadro-640.webp 640w, /landing/cuadro-1200.webp 1200w"
                sizes={BRACKET_CROP_SIZES}
                alt="Parte central de un cuadro de eliminatorias en PorrApp: cuartos, semifinales y la final, con España campeona."
                loading="lazy"
                width="1200"
                height="812"
                className="absolute max-w-none h-auto"
                style={{ width: '180%', left: '-40%', top: '-39%' }}
              />
            </div>
            <Link to="/demo" className="landing-link self-start">
              Ver un cuadro de ejemplo
            </Link>
          </motion.article>

          <motion.article
            variants={rise}
            {...inView}
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
      </GhostWord>

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
            {...inView}
            className="landing-sticker-album mt-10 list-none"
            aria-label={`Cromos de ${leagueLabel}`}
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
          {...inView}
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

      <motion.section
        variants={rise}
        {...inView}
        aria-labelledby="landing-final-cta"
        className="landing-poster landing-tape mt-6 px-6 py-10 sm:px-10 sm:py-12 flex flex-col items-center gap-5 text-center"
      >
        <h2
          id="landing-final-cta"
          className="poster-title text-[clamp(2rem,5vw,3.4rem)] leading-[0.95]"
        >
          {LANDING_COPY.closingTitle}{' '}
          <span className="marker-ink">{LANDING_COPY.closingMarked}</span>
        </h2>
        <p className="text-[#1f2937] text-lg max-w-130 leading-snug">{LANDING_COPY.closing}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={openLogin} className="landing-btn landing-btn-ink">
            Crear mi liga gratis
          </button>
          <Link to="/demo" className="landing-btn">
            Ver una porra de ejemplo
          </Link>
        </div>
      </motion.section>

      <SiteFooter />
    </div>
  );
}
