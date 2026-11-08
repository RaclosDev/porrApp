import { Link } from 'react-router-dom';
import AppScreens from '../components/landing/AppScreens';
import MarkerHeading from '../components/landing/MarkerHeading';
import NetLine from '../components/landing/NetLine';
import SiteFooter from '../components/landing/SiteFooter';
import type { ContentPage as ContentPageData } from '../seo/pages';
import { openSignupToCreateLeague } from '../utils/loginModal';

interface ContentPageProps {
  page: ContentPageData;
}

/**
 * Página pública de contenido (cómo funciona, porra de LaLiga...). Mismo lenguaje de carteles de
 * papel que la portada, pero sin datos en vivo: su texto sale de seo/pages.ts, el mismo que lleva
 * su HTML prerenderizado. La primera sección va en cartel, como el titular de la portada, y el
 * resto en texto sobre la pared para que la página no sea una fila de tarjetas iguales. Las páginas de
 * cada competición enseñan debajo del titular capturas de una liga de ejemplo.
 */
export default function ContentPage({ page }: ContentPageProps) {
  const openLogin = openSignupToCreateLeague;
  const [first, ...rest] = page.sections;

  return (
    <div className="landing-page max-w-300 my-0 mx-auto pt-4 pb-15 px-4">
      <section className="landing-poster landing-tape mt-6 px-6 py-10 sm:px-10 sm:py-14 flex flex-col gap-6">
        <MarkerHeading
          as="h1"
          onLoad
          text={page.h1}
          marked={page.h1Marked}
          className="text-[clamp(2.4rem,6.5vw,5rem)]"
        />
        <p className="text-[#1f2937] text-lg max-w-160 leading-snug">{page.lede}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={openLogin} className="landing-btn landing-btn-ink">
            Crear mi liga
          </button>
          {page.download ? (
            <a href={page.download.href} download className="landing-btn">
              {page.download.label}
            </a>
          ) : (
            <Link to="/demo" className="landing-btn">
              Ver una porra de ejemplo
            </Link>
          )}
        </div>
      </section>

      {page.screens ? <AppScreens screens={page.screens} /> : null}

      {first ? (
        <article className="landing-poster landing-tape -rotate-1 mt-12 p-6 sm:p-8 max-w-200 mx-auto flex flex-col gap-3">
          <h2 className="poster-title text-3xl sm:text-4xl">{first.heading}</h2>
          {first.paragraphs.map((text) => (
            <p key={text} className="text-[#1f2937] leading-snug">
              {text}
            </p>
          ))}
        </article>
      ) : null}

      {rest.length > 0 ? (
        <div className="max-w-200 mx-auto mt-12 flex flex-col gap-10">
          {rest.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="poster-title text-3xl sm:text-4xl text-white">{section.heading}</h2>
              {section.paragraphs.map((text) => (
                <p key={text} className="text-[#e2e8f0] text-lg leading-relaxed">
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
            <h2 id="faq-title" className="poster-title text-3xl sm:text-4xl text-white">
              Preguntas frecuentes
            </h2>
            <dl className="mt-6 flex flex-col gap-6">
              {page.faq.map((entry) => (
                <div key={entry.question}>
                  <dt className="font-bold text-white text-lg">{entry.question}</dt>
                  <dd className="m-0 mt-1 text-[#e2e8f0] leading-relaxed">{entry.answer}</dd>
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
