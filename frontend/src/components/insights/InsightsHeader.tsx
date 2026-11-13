import { NavLink } from 'react-router-dom';
import { BarChart3, Search } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { LEAGUE_INSIGHTS } from '../../context/leagueInsights';
import { prefetchRoute } from '../layout/prefetchRoute';

interface InsightsHeaderProps {
  leagueName: string;
  /** Resumen bajo el título, p. ej. "21 cuadros · Mundial terminado". */
  summary?: string;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `mb-tab gap-1.5 no-underline ${isActive ? 'mb-tab-active' : ''}`;

/**
 * Título de Estadísticas y Buscador, con el cambio entre las dos páginas en las clases de liga
 * que tienen buscador.
 */
export default function InsightsHeader({ leagueName, summary }: InsightsHeaderProps) {
  const { leagueKind } = useAppContext();
  const { stats, tab, search } = LEAGUE_INSIGHTS[leagueKind];
  return (
    <header className="mb-5 flex flex-col items-center gap-3 text-center">
      <div>
        <h2 className="sr-only">Estadísticas de la liga</h2>
        <p className="mt-1 text-[0.95rem] text-muted">
          <span className="font-semibold text-main">{leagueName}</span>
          {summary ? ` · ${summary}` : ''}
        </p>
      </div>
      {stats && search && (
        <nav aria-label="Estadísticas" className="mb-tabs m-0 max-w-105">
          <NavLink
            to="/stats"
            className={tabClass}
            onMouseEnter={() => prefetchRoute('/stats')}
            onFocus={() => prefetchRoute('/stats')}
          >
            <BarChart3 size={16} aria-hidden="true" />
            {tab ?? stats}
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
