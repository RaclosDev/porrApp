import { Link } from 'react-router-dom';
import { AFFILIATION_NOTICE, CONTENT_PAGES } from '../../seo/pages';
import { SMOOTH_SCROLL_STATE } from '../ScrollOnNavigate';
import { SUPPORT_LINKS } from '../../supportLinks';

interface SiteFooterProps {
  /** Ruta de la página actual: su enlace se marca y no se repite como destino. */
  current?: string;
}

/**
 * Pie de las páginas públicas, con la marca a la izquierda como en Ascension y LoopDeck. Enlaza las páginas de contenido entre sí para que un visitante
 * (y un buscador) llegue a todas desde cualquiera, y deja a mano las páginas legales.
 */
export default function SiteFooter({ current }: SiteFooterProps) {
  return (
    <footer className="fam-footer">
      <Link to="/" state={SMOOTH_SCROLL_STATE} className="fam-brand" aria-label="PorrApp, inicio">
        <span>PorrApp</span>
      </Link>
      <p className="fam-footer__links">
        <span>Apoya el proyecto ☕</span>
        {SUPPORT_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="fam-link"
          >
            {link.label}
          </a>
        ))}
        <Link to="/privacidad" state={SMOOTH_SCROLL_STATE} className="fam-link">
          Privacidad
        </Link>
        <Link to="/aviso-legal" state={SMOOTH_SCROLL_STATE} className="fam-link">
          Aviso legal
        </Link>
      </p>
      <nav aria-label="Porras de PorrApp" className="basis-full">
        <ul className="fam-footer__links list-none p-0">
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
                <Link to={page.path} state={SMOOTH_SCROLL_STATE} className="fam-link">
                  {page.navLabel}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <p className="basis-full m-0 max-w-160 text-xs leading-relaxed">{AFFILIATION_NOTICE}</p>
    </footer>
  );
}
