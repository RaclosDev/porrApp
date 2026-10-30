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

const REPO_URL = 'https://github.com/RaclosDev/porrApp';
const FAN_ANGLES = [-8, -3, 0, 3, 8];

/**
 * Portada para quien aún no ha entrado: un cartel con la porra real del Mundial, los cromos de
 * los primeros de la Porra Global y los dos formatos de liga.
 */
export default function Landing() {
  const { reduced } = useLandingMotion();
  const { leaders, participants, champion, nextFixtures, loading, error } = useLandingData();
  const openLogin = () => window.dispatchEvent(new CustomEvent('open-login-modal'));
  const leader = leaders[0];
  const initial = reduced ? 'show' : 'hidden';

  return (
    <div className="landing-page max-w-300 my-0 mx-auto pt-4 pb-15 px-4">
      <section className="landing-poster landing-tape -rotate-1 mt-6 px-6 py-10 sm:px-10 sm:py-14 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div className="flex flex-col gap-6">
          <MarkerHeading
            as="h1"
            onLoad
            text="La porra de toda la vida,"
            marked="pero bien hecha."
            className="text-[clamp(2.6rem,7vw,5.5rem)]"
          />
          <motion.p
            variants={rise}
            initial={initial}
            animate="show"
            className="text-[#1f2937] text-lg max-w-130 leading-snug"
          >
            Rellena tu cuadro del Mundial o pronostica jornada a jornada, y compite con tus amigos.
            Los puntos se calculan solos con los resultados reales.
          </motion.p>
          <motion.div
            variants={rise}
            initial={initial}
            animate="show"
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
          animate={{ opacity: 1, y: 0, rotate: 4 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="justify-self-center"
        >
          {leader ? (
            <StickerCard
              leader={leader}
              featured
              caption={`Va primero de ${participants} en la Porra Global`}
            />
          ) : (
            <p className="text-[#4b5563] text-sm" role="status">
              {error
                ? 'La clasificación no responde ahora mismo.'
                : loading
                  ? 'Cargando la clasificación…'
                  : 'Todavía no hay cuadros en la Porra Global.'}
            </p>
          )}
        </motion.div>
      </section>

      <NetLine />

      <GhostWord word="Álbum" className="py-10">
        <MarkerHeading
          text="Los cromos de la Porra Global"
          className="text-[clamp(2rem,5vw,3.6rem)] text-white"
        />
        {leaders.length > 0 ? (
          <motion.ul
            variants={fanContainer}
            initial={initial}
            whileInView="show"
            viewport={inViewOnce}
            className="flex flex-wrap justify-center gap-4 lg:gap-0 lg:flex-nowrap mt-10 list-none"
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
          whileInView="show"
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
            whileInView="show"
            viewport={inViewOnce}
            className="landing-poster landing-tape rotate-1 p-6 sm:p-8 flex flex-col gap-4"
          >
            <h3 className="poster-title text-4xl">Cuadro</h3>
            <p className="text-[#1f2937] leading-snug">
              Para el Mundial. Ordenas los grupos, rellenas las eliminatorias hasta el campeón y
              eliges al pichichi. Los cruces se calculan solos y los puntos llegan con cada partido.
            </p>
            <img
              src="/landing/cuadro.png"
              alt="El cuadro del Mundial 2026 en PorrApp: de dieciseisavos a la final, con España campeona."
              loading="lazy"
              width="800"
              height="422"
              className="w-full h-auto rounded-md border border-[rgba(17,24,39,0.2)]"
            />
            <Link to="/demo" className="landing-link self-start">
              Abrir la porra del Mundial
            </Link>
          </motion.article>

          <motion.article
            variants={rise}
            initial={initial}
            whileInView="show"
            viewport={inViewOnce}
            className="landing-poster landing-tape -rotate-1 p-6 sm:p-8 flex flex-col gap-4"
          >
            <h3 className="poster-title text-4xl">Jornadas</h3>
            <p className="text-[#1f2937] leading-snug">
              Para LaLiga, la Premier, la Champions y otras ocho competiciones. Pronosticas el
              marcador de cada partido, y cada uno se cierra solo cuando empieza.
            </p>
            <FixtureSheet fixtures={nextFixtures} onPick={openLogin} />
          </motion.article>
        </div>
        <p className="text-muted text-sm text-center mt-8">
          Se instala en el móvil como una app. Los pronósticos quedan a la vista de la liga en
          cuanto empieza cada partido.
        </p>
      </GhostWord>

      <footer className="mt-10 pt-5 border-t border-t-[rgba(255,255,255,0.08)] flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[#94a3b8] text-[0.85rem]">
        <strong className="text-white">PorrApp</strong>
        <span aria-hidden="true">·</span>
        <a href={REPO_URL} className="landing-link-light" target="_blank" rel="noreferrer">
          Código en GitHub
        </a>
      </footer>
    </div>
  );
}
