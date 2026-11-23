import { Link } from 'react-router-dom';
import LandingLiveDemo from '../components/landing/LandingLiveDemo';
import MarkerHeading from '../components/landing/MarkerHeading';
import StickerCard from '../components/StickerCard';
import NetLine from '../components/landing/NetLine';
import Reveal from '../components/landing/Reveal';
import { revealStyle } from '../components/landing/motion';
import { useLandingData } from '../hooks/useLandingData';
import SiteFooter from '../components/landing/SiteFooter';
import { HOME_FAQ, LANDING_COPY } from '../seo/pages';
import { SIGNUP_TO_CREATE_LEAGUE } from '../utils/authRoutes';

const FAN_ANGLES = [-8, -3, 0, 3, 8];

/**
 * Portada para quien aún no ha entrado: qué es, cómo se ve en el móvil, cómo se juega, los deportes
 * y formatos de liga, los cromos de la liga pública destacada y una última llamada a crear la liga.
 */
export default function Landing() {
  const { leaders, leagueName, champion, loading, error } = useLandingData();
  const leagueLabel = leagueName ?? 'la liga pública';

  return (
    <div className="landing-page fam fam-container pb-15">
      <section className="fam-hero">
        <div className="flex flex-col gap-6">
          <MarkerHeading
            as="h1"
            onLoad
            text={LANDING_COPY.h1}
            marked={LANDING_COPY.h1Marked}
            className="fam-h1"
          />
          {/* Sin fundido: es el elemento más grande de la primera pantalla (LCP) y debe pintarse ya. */}
          <p className="fam-lede">{LANDING_COPY.lede}</p>
          <Reveal onLoad className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Link
                id="btn-hero-login"
                to={SIGNUP_TO_CREATE_LEAGUE}
                className="fam-btn fam-btn--ink fam-btn--lg"
              >
                Crear mi liga gratis
              </Link>
              <Link to="/demo" className="fam-btn fam-btn--lg">
                Probar la demo
              </Link>
            </div>
          </Reveal>
        </div>
        <Reveal
          onLoad
          id="pruebalo"
          style={revealStyle({ '--from-y': '40px', '--dur': '0.7s', '--base': '400ms' })}
          className="fam-hero__demo"
        >
          <LandingLiveDemo />
        </Reveal>
      </section>

      <NetLine />

      <section id="como-se-juega" className="py-10 scroll-mt-4">
        <MarkerHeading text={LANDING_COPY.stepsTitle} className="fam-h2" />
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

      <section id="deportes" className="py-10 scroll-mt-4">
        <MarkerHeading text={LANDING_COPY.formatsTitle} className="fam-h2" />
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] mt-10 items-start">
          <Reveal
            as="ul"
            className="list-none p-0 m-0 border-b border-[rgba(17,24,39,0.16)]"
            aria-label="Deportes y competiciones"
          >
            {LANDING_COPY.sports.map((sport) => (
              <li key={sport.path} className="border-t border-[rgba(17,24,39,0.16)]">
                <Link to={sport.path} className="landing-sport-row">
                  <span className="poster-title landing-sport-name">{sport.name}</span>
                  <span className="text-[#3f4652] leading-snug">{sport.text}</span>
                </Link>
              </li>
            ))}
          </Reveal>

          <Reveal as="article" className="landing-poster p-6 sm:p-8 flex flex-col gap-4">
            <h3 className="poster-title text-4xl">{LANDING_COPY.matchdayTitle}</h3>
            <p className="text-[#3f4652] leading-snug">{LANDING_COPY.matchdayText}</p>
            <h3 className="poster-title text-4xl mt-4 pt-6 border-t border-[rgba(17,24,39,0.16)]">
              {LANDING_COPY.bracketTitle}
            </h3>
            <p className="text-[#3f4652] leading-snug">{LANDING_COPY.bracketText}</p>
            <Link to="/demo" className="landing-link self-start">
              Ver un cuadro de ejemplo
            </Link>
          </Reveal>
        </div>
      </section>

      <NetLine />

      <section className="py-10">
        <MarkerHeading text={`Los cromos de ${leagueLabel}`} className="fam-h2" />
        {leaders.length === 0 && loading && !error ? (
          // Mismo alto que el álbum: al llegar los cromos la página no crece de golpe.
          <div className="landing-sticker-album-slot mt-10" aria-hidden="true" />
        ) : null}
        {leaders.length === 0 && (error || !loading) ? (
          <p className="text-[#48505c] text-sm text-center mt-10" role="status">
            {error
              ? 'La clasificación no responde ahora mismo.'
              : `Todavía no hay cuadros en ${leagueLabel}.`}
          </p>
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
          <h2 id="landing-final-cta" className="fam-h2">
            {LANDING_COPY.closingTitle}{' '}
            <span className="fam-mark">{LANDING_COPY.closingMarked}</span>
          </h2>
          <p className="fam-lede">{LANDING_COPY.closing}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:shrink-0">
          <Link to={SIGNUP_TO_CREATE_LEAGUE} className="fam-btn fam-btn--ink fam-btn--lg">
            Crear mi liga gratis
          </Link>
          <Link to="/demo" className="fam-btn fam-btn--lg">
            Probar la demo
          </Link>
        </div>
      </Reveal>

      <SiteFooter />
    </div>
  );
}
