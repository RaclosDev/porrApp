import { prefetchRoute } from './prefetchRoute';
import { NavLink } from 'react-router-dom';

interface MainNavProps {
  isDemo: boolean;
  isMatchDayLeague: boolean;
  isNavLocked: boolean;
}

/** Navegación principal de escritorio. */
export default function MainNav({ isDemo, isMatchDayLeague, isNavLocked }: MainNavProps) {
  return (
    <div className="header-center">
      {/* Navegación */}
      <nav
        className="nav-links"
        inert={isNavLocked}
        aria-disabled={isNavLocked || undefined}
        style={isNavLocked ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
      >
        {isDemo ? (
          <>
            <NavLink
              to="/demo"
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Inicio
            </NavLink>
            <NavLink
              to="/prediction"
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Mi Porra
            </NavLink>
            <NavLink
              to="/bracket"
              onMouseEnter={() => prefetchRoute('/bracket')}
              onFocus={() => prefetchRoute('/bracket')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Resultados
            </NavLink>
            <NavLink
              to="/grupos"
              onMouseEnter={() => prefetchRoute('/grupos')}
              onFocus={() => prefetchRoute('/grupos')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Grupos
            </NavLink>
            <NavLink
              to="/ranking"
              onMouseEnter={() => prefetchRoute('/ranking')}
              onFocus={() => prefetchRoute('/ranking')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Ranking
            </NavLink>
          </>
        ) : isMatchDayLeague ? (
          <>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Inicio
            </NavLink>
            <NavLink
              to="/jornadas"
              onMouseEnter={() => prefetchRoute('/jornadas')}
              onFocus={() => prefetchRoute('/jornadas')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Jornadas
            </NavLink>
            <NavLink
              to="/ranking"
              onMouseEnter={() => prefetchRoute('/ranking')}
              onFocus={() => prefetchRoute('/ranking')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Ranking
            </NavLink>
            <NavLink
              to="/tabla"
              onMouseEnter={() => prefetchRoute('/tabla')}
              onFocus={() => prefetchRoute('/tabla')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Tabla
            </NavLink>
            <NavLink
              to="/mis-ligas"
              onMouseEnter={() => prefetchRoute('/mis-ligas')}
              onFocus={() => prefetchRoute('/mis-ligas')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Mis Ligas
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Inicio
            </NavLink>
            <NavLink
              to="/prediction"
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Mi Porra
            </NavLink>
            <NavLink
              to="/bracket"
              onMouseEnter={() => prefetchRoute('/bracket')}
              onFocus={() => prefetchRoute('/bracket')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Resultados
            </NavLink>
            <NavLink
              to="/ranking"
              onMouseEnter={() => prefetchRoute('/ranking')}
              onFocus={() => prefetchRoute('/ranking')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Ranking
            </NavLink>
            <NavLink
              to="/mis-ligas"
              onMouseEnter={() => prefetchRoute('/mis-ligas')}
              onFocus={() => prefetchRoute('/mis-ligas')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Mis Ligas
            </NavLink>
          </>
        )}
      </nav>
    </div>
  );
}
