import { NavLink } from 'react-router-dom';
import { BarChart3, Search } from 'lucide-react';
import { prefetchRoute } from '../layout/prefetchRoute';

interface InsightsHeaderProps {
  leagueName: string;
  /** Resumen bajo el título, p. ej. "21 cuadros · Mundial terminado". */
  summary?: string;
  /** El buscador solo existe en las ligas de cuadro. */
  withSearch: boolean;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `mb-tab gap-1.5 no-underline ${isActive ? 'mb-tab-active' : ''}`;

/** Título de Estadísticas y Buscador, con el cambio entre las dos páginas. */
export default function InsightsHeader({ leagueName, summary, withSearch }: InsightsHeaderProps) {
  return (
    <header className="mb-5 flex flex-col items-center gap-3 text-center">
      <div>
        <h2 className="m-0 text-[1.5rem] font-extrabold text-main sm:text-[1.9rem]">
          Estadísticas de la liga
        </h2>
        <p className="mt-1 text-[0.95rem] text-muted">
          <span className="font-semibold text-main">{leagueName}</span>
          {summary ? ` · ${summary}` : ''}
        </p>
      </div>
      {withSearch && (
        <nav aria-label="Estadísticas" className="mb-tabs m-0 max-w-105">
          <NavLink
            to="/stats"
            className={tabClass}
            onMouseEnter={() => prefetchRoute('/stats')}
            onFocus={() => prefetchRoute('/stats')}
          >
            <BarChart3 size={16} aria-hidden="true" />
            Más elegidos
          </NavLink>
          <NavLink
            to="/search"
            className={tabClass}
            onMouseEnter={() => prefetchRoute('/search')}
            onFocus={() => prefetchRoute('/search')}
          >
            <Search size={16} aria-hidden="true" />
            Buscador
          </NavLink>
        </nav>
      )}
    </header>
  );
}
