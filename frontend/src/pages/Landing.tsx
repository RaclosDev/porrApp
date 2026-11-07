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

const FAN_ANGLES = [-8, -3, 0, 3, 8];

const STEPS = [
  {
    title: 'Crea tu liga',
    text: 'Elige el formato: el cuadro de unas eliminatorias, como la Champions, o las jornadas de LaLiga, la Premier y otras competiciones.',
  },
  {
    title: 'Invita con un enlace',
    text: 'Pásalo por el grupo. Tus amigos lo abren, entran con su cuenta de Google y ya están dentro.',
  },
  {
    title: 'Predice y compite',
    text: 'Cada predicción se cierra cuando empieza el partido. Los puntos y la clasificación se actualizan solos con los resultados reales.',
  },
] as const;

/**
 * Portada para quien aún no ha entrado: qué es y cómo se juega, los dos formatos de liga, los
 * cromos de los primeros de la liga pública destacada y una última llamada a crear la liga.
 */
export default function Landing() {
  const { reduced, visible } = useLandingMotion();
  const { leaders, leagueName, participants, champion, nextFixtures, loading, error } =
    useLandingData();
  const leagueLabel = leagueName ?? 'la liga pública';
  const openLogin = () => window.dispatchEvent(new CustomEvent('open-login-modal'));
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
            text="La porra de toda la vida,"
            marked="pero bien hecha."
            className="text-[clamp(2.6rem,7vw,5.5rem)]"
          />
          <motion.p
            variants={rise}
            initial={initial}
            animate={visible ? 'show' : undefined}
            className="text-[#1f2937] text-lg max-w-130 leading-snug"
          >
            Porras de fútbol gratis con tus amigos. Rellena el cuadro de la Champions o haz tus
            predicciones de LaLiga, la Premier y más, jornada a jornada. Los puntos se calculan
            solos con los resultados reales.
          </motion.p>
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
            <p className="text-[#4b5563] text-sm">
              Entras con tu cuenta de Google. Sin descargas ni anuncios.
            </p>
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
        <MarkerHeading text="Cómo se juega" className="text-[clamp(2rem,5vw,3.6rem)] text-white" />
        <motion.ol
          variants={fanContainer}
          {...inView}
          className="grid gap-6 md:grid-cols-3 mt-10 list-none p-0"
          aria-label="Pasos para jugar"
        >
          {STEPS.map((step, index) => (
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
          text="Dos formas de jugar"
          className="text-[clamp(2rem,5vw,3.6rem)] text-white"
        />
        <div className="grid gap-8 lg:grid-cols-2 mt-10 items-start">
          <motion.article
            variants={rise}
            {...inView}
            className="landing-poster landing-tape rotate-1 p-6 sm:p-8 flex flex-col gap-4"
          >
            <h3 className="poster-title text-4xl">Cuadro</h3>
            <p className="text-[#1f2937] leading-snug">
              Para las eliminatorias, como la Champions o el Mundial. Rellenas los cruces hasta el
              campeón y los puntos llegan solos con cada partido.
            </p>
            {/* Solo la parte central del cuadro, para que los cruces y la final se lean. */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-[rgba(17,24,39,0.2)]">
              <img
                src="/landing/cuadro.jpg"
                alt="Parte central de un cuadro de eliminatorias en PorrApp: cuartos, semifinales y la final, con España campeona."
                loading="lazy"
                width="1600"
                height="1082"
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
            <h3 className="poster-title text-4xl">Jornadas</h3>
            <p className="text-[#1f2937] leading-snug">
              Para LaLiga, la Premier, la Champions y otras ocho competiciones. Predices el signo
              (1X2) o el marcador exacto, según elija la liga, y cada partido se cierra solo cuando
              empieza.
            </p>
            <figure className="m-0">
              <img
                src="/landing/jornadas.jpg"
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
          Tu grupo ya discute de fútbol. <span className="marker-ink">Que cuente para algo.</span>
        </h2>
        <p className="text-[#1f2937] text-lg max-w-130 leading-snug">
          Crea la liga, pasa el enlace y que hablen los resultados. Se instala en el móvil como una
          app.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={openLogin} className="landing-btn landing-btn-ink">
            Crear mi liga gratis
          </button>
          <Link to="/demo" className="landing-btn">
            Ver una porra de ejemplo
          </Link>
        </div>
      </motion.section>

      <footer className="mt-10 pt-5 border-t border-t-[rgba(255,255,255,0.08)] flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[#94a3b8] text-[0.85rem]">
        <strong className="text-white">PorrApp</strong>
        <span aria-hidden="true">·</span>
        <Link
          to="/privacidad"
          className="underline hover:text-white inline-flex items-center min-h-11"
        >
          Privacidad
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/aviso-legal"
          className="underline hover:text-white inline-flex items-center min-h-11"
        >
          Aviso legal
        </Link>
      </footer>
    </div>
  );
}
