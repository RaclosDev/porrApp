import { Link } from 'react-router-dom';
import { AFFILIATION_NOTICE, CONTENT_PAGES } from '../../seo/pages';
import { SMOOTH_SCROLL_STATE } from '../ScrollOnNavigate';

const linkClass = 'underline hover:text-white inline-flex items-center min-h-11';

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
    <footer className="mt-10 pt-5 border-t border-t-[rgba(255,255,255,0.08)] flex flex-col items-center gap-2 text-[#94a3b8] text-[0.85rem]">
      <nav aria-label="Porras de PorrApp">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-0 list-none m-0 p-0">
          {CONTENT_PAGES.map((page) => (
            <li key={page.path}>
              {page.path === current ? (
                <span aria-current="page" className="inline-flex items-center min-h-11 text-white">
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
      <div className="flex flex-wrap justify-center items-center gap-x-3">
        <Link
          to="/"
          state={SMOOTH_SCROLL_STATE}
          className="font-bold text-white hover:underline inline-flex items-center min-h-11"
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
