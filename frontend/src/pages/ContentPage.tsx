import { Link } from 'react-router-dom';
import AppScreens from '../components/landing/AppScreens';
import MarkerHeading from '../components/landing/MarkerHeading';
import NetLine from '../components/landing/NetLine';
import ScoreboardDemo from '../components/landing/ScoreboardDemo';
import SiteFooter from '../components/landing/SiteFooter';
import type { ContentPage as ContentPageData } from '../seo/pages';
import { SIGNUP_TO_CREATE_LEAGUE } from '../utils/authRoutes';

interface ContentPageProps {
  page: ContentPageData;
}

/**
 * Página pública de contenido (cómo funciona, porra de LaLiga...). Misma pared de papel claro que
 * la portada, pero sin datos en vivo: su texto sale de seo/pages.ts, el mismo que lleva su HTML
 * prerenderizado. Todo va en una columna de lectura; la primera sección va en una hoja y el resto
 * en texto sobre la pared para que la página no sea una fila de tarjetas iguales. Las páginas de
 * cada competición enseñan debajo del titular capturas de la app con partidos reales.
 */
export default function ContentPage({ page }: ContentPageProps) {
  const [first, ...rest] = page.sections;

  return (
    <div className="landing-page fam fam-container pt-4 pb-15">
      <section className="max-w-200 mx-auto mt-6 sm:mt-12">
        <MarkerHeading as="h1" onLoad text={page.h1} marked={page.h1Marked} className="fam-h1" />
        <p className="fam-lede">{page.lede}</p>
        <div className="fam-cta-row">
          <Link to={SIGNUP_TO_CREATE_LEAGUE} className="fam-btn fam-btn--ink fam-btn--lg">
            Crear mi liga
          </Link>
          {page.download ? (
            <a href={page.download.href} download className="fam-btn fam-btn--lg">
              {page.download.label}
            </a>
          ) : page.scoreboardDemo ? (
            <a href="#demo" className="fam-btn fam-btn--lg">
              Probar la hoja de puntos
            </a>
          ) : (
            <Link
              to={page.demoLeague ? `/demo?liga=${page.demoLeague}` : '/demo'}
              className="fam-btn fam-btn--lg"
            >
              Probar la demo
            </Link>
          )}
        </div>
      </section>

      {page.screens ? <AppScreens screens={page.screens} /> : null}

      {page.scoreboardDemo ? <ScoreboardDemo /> : null}

      {first ? (
        <article className="landing-poster mt-14 p-6 sm:p-8 max-w-200 mx-auto flex flex-col gap-3">
          <h2 className="fam-h2">{first.heading}</h2>
          {first.paragraphs.map((text) => (
            <p key={text} className="text-[#3f4652] max-w-[70ch] leading-relaxed">
              {text}
            </p>
          ))}
        </article>
      ) : null}

      {rest.length > 0 ? (
        <div className="max-w-200 mx-auto mt-14 flex flex-col gap-12">
          {rest.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="fam-h2">{section.heading}</h2>
              {section.paragraphs.map((text) => (
                <p key={text} className="text-[#3f4652] text-lg max-w-[70ch] leading-relaxed">
                  {text}
                </p>
              ))}
            </section>
          ))}
        </div>
      ) : null}

      {page.faq ? (
        <>
          <NetLine />
          <section className="max-w-200 mx-auto py-6" aria-labelledby="faq-title">
            <h2 id="faq-title" className="fam-h2">
              Preguntas frecuentes
            </h2>
            <dl className="mt-6 flex flex-col border-b border-[rgba(17,24,39,0.16)]">
              {page.faq.map((entry) => (
                <div key={entry.question} className="py-5 border-t border-[rgba(17,24,39,0.16)]">
                  <dt className="font-bold text-[#111827] text-lg">{entry.question}</dt>
                  <dd className="m-0 mt-1 max-w-[70ch] text-[#3f4652] leading-relaxed">
                    {entry.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : null}

      <SiteFooter current={page.path} />
    </div>
  );
}
