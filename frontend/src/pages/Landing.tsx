import { Skeleton } from '../components/SkeletonBlock';
import { Link } from 'react-router-dom';
import MarkerHeading from '../components/landing/MarkerHeading';
import StickerCard from '../components/StickerCard';
import NetLine from '../components/landing/NetLine';
import FixtureSheet from '../components/landing/FixtureSheet';
import Reveal from '../components/landing/Reveal';
import { revealStyle } from '../components/landing/motion';
import { useLandingData } from '../hooks/useLandingData';
import SiteFooter from '../components/landing/SiteFooter';
import { HOME_FAQ, LANDING_COPY } from '../seo/pages';
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
  const { leaders, leagueName, participants, champion, nextFixtures, loading, error } =
    useLandingData();
  const leagueLabel = leagueName ?? 'la liga pública';
  const openLogin = openSignupToCreateLeague;
  const leader = leaders[0];

  return (
    <div className="landing-page max-w-300 my-0 mx-auto pt-4 pb-15 px-4">
      <section className="mt-6 sm:mt-12 grid gap-10 md:grid-cols-[1.25fr_1fr] md:items-center">
        <div className="flex flex-col gap-6">
          <MarkerHeading
            as="h1"
            onLoad
            text={LANDING_COPY.h1}
            marked={LANDING_COPY.h1Marked}
            className="text-[clamp(2.8rem,7.4vw,5.75rem)]"
          />
          {/* Sin fundido: es el elemento más grande de la primera pantalla (LCP) y debe pintarse ya. */}
          <p className="text-[#3f4652] text-lg max-w-130 leading-snug">{LANDING_COPY.lede}</p>
          <Reveal onLoad className="flex flex-col gap-3">
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
            <p className="text-[#48505c] text-sm">{LANDING_COPY.heroNote}</p>
          </Reveal>
        </div>
        <Reveal
          onLoad
          style={revealStyle({ '--from-y': '40px', '--dur': '0.7s', '--base': '400ms' })}
          className="landing-poster landing-tape landing-hero-podium min-w-0 w-full justify-self-center px-4 pt-8 pb-5 sm:px-6"
        >
          {leader ? (
            <div>
              <p className="landing-card-title text-center">Clasificación en vivo</p>
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
              <p className="text-[#48505c] text-sm text-center">
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
            <p className="text-[#48505c] text-sm text-center py-16" role="status">
              {error
                ? 'La clasificación no responde ahora mismo.'
                : `Todavía no hay cuadros en ${leagueLabel}.`}
            </p>
          )}
        </Reveal>
      </section>

      <NetLine />

      <section className="py-10">
        <MarkerHeading text={LANDING_COPY.stepsTitle} className="text-[clamp(2rem,5vw,3.6rem)]" />
        <Reveal
          as="ol"
          group
          className="grid md:grid-cols-3 mt-10 list-none p-0 rounded-[4px] border-2 border-[#111827] bg-[#f3ecdc] divide-y md:divide-y-0 md:divide-x divide-[rgba(17,24,39,0.16)]"
          aria-label="Pasos para jugar"
        >
          {LANDING_COPY.steps.map((step, index) => (
            <li
              key={step.title}
              style={revealStyle({ '--i': index })}
              className="reveal p-6 sm:p-8 flex flex-col gap-3"
            >
              <span className="poster-title text-5xl text-[#0b5f74]" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="poster-title text-3xl">{step.title}</h3>
              <p className="text-[#3f4652] leading-snug">{step.text}</p>
            </li>
          ))}
        </Reveal>
      </section>

      <NetLine />

      <section className="py-10">
        <MarkerHeading text={LANDING_COPY.formatsTitle} className="text-[clamp(2rem,5vw,3.6rem)]" />
        <div className="grid gap-8 lg:grid-cols-2 mt-10 items-start">
          <Reveal as="article" className="landing-poster p-6 sm:p-8 flex flex-col gap-4">
            <h3 className="poster-title text-4xl">{LANDING_COPY.bracketTitle}</h3>
            <p className="text-[#3f4652] leading-snug">{LANDING_COPY.bracketText}</p>
            {/* Solo la parte central del cuadro, para que los cruces y la final se lean. */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-[4px] border border-[rgba(17,24,39,0.3)]">
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
          </Reveal>

          <Reveal as="article" className="landing-poster p-6 sm:p-8 flex flex-col gap-4">
            <h3 className="poster-title text-4xl">{LANDING_COPY.matchdayTitle}</h3>
            <p className="text-[#3f4652] leading-snug">{LANDING_COPY.matchdayText}</p>
            <figure className="m-0">
              <img
                src="/landing/jornadas-1080.webp"
                srcSet="/landing/jornadas-640.webp 640w, /landing/jornadas-1080.webp 1080w"
                sizes={SCREENSHOT_SIZES}
                alt="Inicio de una liga por jornadas: partidos, clasificación de participantes y tabla de LaLiga."
                loading="lazy"
                width="1080"
                height="706"
                className="w-full h-auto rounded-[4px] border border-[rgba(17,24,39,0.3)]"
              />
              <figcaption className="text-sm text-[#48505c] mt-2">
                Ejemplo del inicio de una liga por jornadas con datos de demostración.
              </figcaption>
            </figure>
            <FixtureSheet fixtures={nextFixtures} onPick={openLogin} />
          </Reveal>
        </div>
      </section>

      <NetLine />

      <section className="py-10">
        <MarkerHeading
          text={`Los cromos de ${leagueLabel}`}
          className="text-[clamp(2rem,5vw,3.6rem)]"
        />
        {leaders.length === 0 && loading && !error ? (
          // Mismo alto que el álbum: al llegar los cromos la página no crece de golpe.
          <div className="landing-sticker-album-slot mt-10" aria-hidden="true" />
        ) : null}
        {leaders.length > 0 ? (
          <Reveal
            as="ul"
            group
            className="landing-sticker-album mt-10 list-none"
            aria-label={`Cromos de ${leagueLabel}`}
          >
            {leaders.map((row, index) => (
              <li
                key={row.userId ?? row.name}
                style={revealStyle({
                  '--from-y': '60px',
                  '--dur': '0.6s',
                  '--i': index,
                  '--rot': `${FAN_ANGLES[index] ?? 0}deg`,
                })}
                className="reveal lg:-ml-6 lg:first:ml-0"
              >
                <StickerCard leader={row} />
              </li>
            ))}
          </Reveal>
        ) : null}
        <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {champion ? (
            <span className="ink-stamp ink-stamp-paper">
              {champion.team} campeona en {champion.count} de {champion.total} cuadros
            </span>
          ) : null}
          <Link to="/demo" className="landing-link">
            Ver la clasificación completa
          </Link>
        </Reveal>
      </section>

      <NetLine />

      <section className="max-w-200 mx-auto py-6" aria-labelledby="landing-faq-title">
        <h2 id="landing-faq-title" className="poster-title text-3xl sm:text-4xl">
          Preguntas frecuentes
        </h2>
        <dl className="mt-6 flex flex-col border-b border-[rgba(17,24,39,0.16)]">
          {HOME_FAQ.map((entry) => (
            <div key={entry.question} className="py-5 border-t border-[rgba(17,24,39,0.16)]">
              <dt className="font-bold text-[#111827] text-lg">{entry.question}</dt>
              <dd className="m-0 mt-1 max-w-[70ch] text-[#3f4652] leading-relaxed">
                {entry.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Reveal
        as="section"
        aria-labelledby="landing-final-cta"
        className="landing-poster mt-10 px-6 py-8 sm:px-10 sm:py-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-col gap-3">
          <h2
            id="landing-final-cta"
            className="poster-title text-[clamp(2rem,4.4vw,3.2rem)] leading-[0.95]"
          >
            {LANDING_COPY.closingTitle}{' '}
            <span className="marker-ink">{LANDING_COPY.closingMarked}</span>
          </h2>
          <p className="text-[#3f4652] text-lg max-w-130 leading-snug">{LANDING_COPY.closing}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:shrink-0">
          <button type="button" onClick={openLogin} className="landing-btn landing-btn-ink">
            Crear mi liga gratis
          </button>
          <Link to="/demo" className="landing-btn">
            Ver una porra de ejemplo
          </Link>
        </div>
      </Reveal>

      <SiteFooter />
    </div>
  );
}
