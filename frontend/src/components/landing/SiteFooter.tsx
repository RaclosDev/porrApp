import { Link } from 'react-router-dom';
import { AFFILIATION_NOTICE, CONTENT_PAGES } from '../../seo/pages';
import { SMOOTH_SCROLL_STATE } from '../ScrollOnNavigate';
import { SUPPORT_LINKS } from '../../supportLinks';

const linkClass =
  'underline underline-offset-3 hover:text-[#111827] inline-flex items-center min-h-11';

interface SiteFooterProps {
  /** Ruta de la página actual: su enlace se marca y no se repite como destino. */
  current?: string;
}

/**
 * Pie de las páginas públicas. Enlaza las páginas de contenido entre sí para que un visitante
 * (y un buscador) llegue a todas desde cualquiera, y deja a mano las páginas legales.
 */
export default function SiteFooter({ current }: SiteFooterProps) {
  return (
    <footer className="mt-16 pt-6 border-t-2 border-t-[rgba(17,24,39,0.12)] flex flex-col items-center gap-2 text-[#48505c] text-[0.85rem]">
      <nav aria-label="Porras de PorrApp">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-0 list-none m-0 p-0">
          {CONTENT_PAGES.map((page) => (
            <li key={page.path}>
              {page.path === current ? (
                <span
                  aria-current="page"
                  className="inline-flex items-center min-h-11 font-semibold text-[#111827]"
                >
                  {page.navLabel}
                </span>
              ) : (
                <Link to={page.path} state={SMOOTH_SCROLL_STATE} className={linkClass}>
                  {page.navLabel}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <p className="m-0 flex flex-wrap justify-center items-center gap-x-3">
        <span>Apoya el proyecto ☕</span>
        {SUPPORT_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {link.label}
          </a>
        ))}
      </p>
      <div className="flex flex-wrap justify-center items-center gap-x-3">
        <Link
          to="/"
          state={SMOOTH_SCROLL_STATE}
          className="font-bold text-[#111827] hover:underline inline-flex items-center min-h-11"
        >
          PorrApp
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacidad" state={SMOOTH_SCROLL_STATE} className={linkClass}>
          Privacidad
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/aviso-legal" state={SMOOTH_SCROLL_STATE} className={linkClass}>
          Aviso legal
        </Link>
      </div>
      <p className="m-0 max-w-160 text-center text-xs leading-relaxed">{AFFILIATION_NOTICE}</p>
    </footer>
  );
}
