import { prefetchRoute } from './prefetchRoute';
import { NavLink } from 'react-router-dom';
import type { LeagueNavItem } from './leagueNav';

interface MainNavProps {
  /** Secciones de la liga activa (`leagueNavItems`); `null` mientras no se sabe cuáles lleva. */
  items: readonly LeagueNavItem[] | null;
  isNavLocked: boolean;
}

/** Navegación principal de escritorio. */
export default function MainNav({ items, isNavLocked }: MainNavProps) {
  if (!items) {
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
      <nav
        className="nav-links"
        inert={isNavLocked}
        style={isNavLocked ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onMouseEnter={() => prefetchRoute(item.to)}
            onFocus={() => prefetchRoute(item.to)}
            className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
