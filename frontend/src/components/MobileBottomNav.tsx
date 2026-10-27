import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Trophy, Users, Calendar, Pencil, Swords, LayoutGrid, BookOpen } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

/**
 * Barra de navegación móvil estilo "Isla Flotante" / "Cápsula" (Floating Dock)
 * Elevada respecto al fondo, centrada con bordes redondeados y efecto glassmorphic.
 * Proporciona acceso ergonómico sin sensación de pie de página tosco.
 */
export default function MobileBottomNav() {
  const { activeGroupPoolFormat, activeCompetitionFormatType, isDemoMode } = useAppContext();

  const location = useLocation();
  const isDemo =
    isDemoMode || location.pathname === '/demo' || location.pathname === '/mundial-2026';
  const isMatchDay =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  const navItems = isDemo
    ? [
        { to: '/demo', label: 'Inicio', icon: Home },
        { to: '/bracket', label: 'Resultados', icon: Swords },
        { to: '/grupos', label: 'Grupos', icon: LayoutGrid },
        { to: '/clasificacion', label: 'Ranking', icon: Trophy },
        { to: '/reglas', label: 'Reglas', icon: BookOpen },
      ]
    : isMatchDay
      ? [
          { to: '/', label: 'Inicio', icon: Home, end: true },
          { to: '/jornadas', label: 'Jornadas', icon: Calendar },
          { to: '/clasificacion', label: 'Puntos', icon: Trophy },
          { to: '/mis-ligas', label: 'Mis Ligas', icon: Users },
          { to: '/reglas', label: 'Reglas', icon: BookOpen },
        ]
      : [
          { to: '/', label: 'Inicio', icon: Home, end: true },
          { to: '/prediction', label: 'Mi Porra', icon: Pencil },
          { to: '/bracket', label: 'Resultados', icon: Swords },
          { to: '/clasificacion', label: 'Ranking', icon: Trophy },
          { to: '/mis-ligas', label: 'Mis Ligas', icon: Users },
        ];

  return (
    <nav
      className="mobile-bottom-nav floating-capsule-nav"
      aria-label="Navegación principal móvil"
      style={{
        position: 'fixed',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '430px',
        height: '62px',
        background: 'rgba(12, 18, 34, 0.88)',
        backdropFilter: 'blur(24px) saturate(190%)',
        WebkitBackdropFilter: 'blur(24px) saturate(190%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 6px',
        zIndex: 1000,
        boxShadow:
          '0 16px 36px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      }}
    >
      {navItems.map((item) => {
        const IconComponent = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              textDecoration: 'none',
              flex: 1,
              height: '50px',
              borderRadius: '25px',
              background: isActive ? 'rgba(0, 210, 211, 0.14)' : 'transparent',
              color: isActive ? 'var(--accent-cyan, #00d2d3)' : '#94a3b8',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              WebkitTapHighlightColor: 'transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    filter: isActive ? 'drop-shadow(0 0 8px rgba(0, 210, 211, 0.55))' : 'none',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <IconComponent
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    color={isActive ? 'var(--accent-cyan, #00d2d3)' : '#94a3b8'}
                  />
                </span>
                <span
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.2px',
                    color: isActive ? 'var(--accent-cyan, #00d2d3)' : '#8899a6',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
