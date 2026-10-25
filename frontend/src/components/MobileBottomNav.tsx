import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

/**
 * Barra de navegación inferior móvil (Bottom Navigation Bar)
 * Diseñada para ergonomía de uso con una sola mano en smartphones.
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
        { to: '/demo', label: 'Inicio', icon: '🏠' },
        { to: '/cuadro', label: 'Cuadro', icon: '⚽' },
        { to: '/grupos', label: 'Grupos', icon: '📊' },
        { to: '/clasificacion', label: 'Ranking', icon: '🏆' },
        { to: '/reglas', label: 'Reglas', icon: '📜' },
      ]
    : isMatchDay
      ? [
          { to: '/', label: 'Inicio', icon: '🏠', end: true },
          { to: '/jornadas', label: 'Jornadas', icon: '⚽' },
          { to: '/clasificacion', label: 'Puntos', icon: '🏆' },
          { to: '/mis-ligas', label: 'Mis Ligas', icon: '👥' },
          { to: '/reglas', label: 'Reglas', icon: '📜' },
        ]
      : [
          { to: '/', label: 'Inicio', icon: '🏠', end: true },
          { to: '/bracket', label: 'Porra', icon: '✍️' },
          { to: '/cuadro', label: 'Cuadro', icon: '⚽' },
          { to: '/clasificacion', label: 'Ranking', icon: '🏆' },
          { to: '/mis-ligas', label: 'Mis Ligas', icon: '👥' },
        ];

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Navegación principal móvil"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(11, 15, 25, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            textDecoration: 'none',
            flex: 1,
            height: '100%',
            color: isActive ? 'var(--accent-cyan, #00d2d3)' : '#94a3b8',
            transition: 'color 0.15s ease, transform 0.1s ease',
            WebkitTapHighlightColor: 'transparent',
          })}
        >
          {({ isActive }) => (
            <>
              <span
                style={{
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  filter: isActive ? 'drop-shadow(0 0 8px rgba(0, 210, 211, 0.6))' : 'none',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 800 : 600,
                  letterSpacing: '0.2px',
                  color: isActive ? 'var(--accent-cyan, #00d2d3)' : '#94a3b8',
                }}
              >
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
