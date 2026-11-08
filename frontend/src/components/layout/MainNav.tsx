import { prefetchRoute } from './prefetchRoute';
import { NavLink } from 'react-router-dom';

interface MainNavProps {
  isDemo: boolean;
  isMatchDayLeague: boolean;
  /** Liga de Fórmula 1: su inicio son los Grandes Premios. */
  isGrandPrixLeague?: boolean;
  /** Liga de la UFC: su tabla es la cartelera de la velada. */
  isUfcLeague?: boolean;
  isNavLocked: boolean;
  /** La liga es del Mundial: la única con pestaña de fase de grupos. */
  showGroups?: boolean;
  /** Aún no se sabe el formato de la liga activa, así que tampoco qué secciones lleva. */
  formatPending?: boolean;
}

/** Navegación principal de escritorio. */
export default function MainNav({
  isDemo,
  isMatchDayLeague,
  isGrandPrixLeague = false,
  isUfcLeague = false,
  isNavLocked,
  showGroups = false,
  formatPending = false,
}: MainNavProps) {
  if (formatPending && !isDemo) {
    return (
      <div className="header-center">
        <div className="nav-links" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((slot) => (
            <span key={slot} className="chrome-placeholder w-22 h-11.25" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="header-center">
      {/* Navegación */}
      <nav
        className="nav-links"
        inert={isNavLocked}
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
            {showGroups && (
              <NavLink
                to="/grupos"
                onMouseEnter={() => prefetchRoute('/grupos')}
                onFocus={() => prefetchRoute('/grupos')}
                className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
              >
                Grupos
              </NavLink>
            )}
            <NavLink
              to="/ranking"
              onMouseEnter={() => prefetchRoute('/ranking')}
              onFocus={() => prefetchRoute('/ranking')}
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Ranking
            </NavLink>
          </>
        ) : isGrandPrixLeague ? (
          <>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Grandes Premios
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
              {isUfcLeague ? 'Cartelera' : 'Tabla'}
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
