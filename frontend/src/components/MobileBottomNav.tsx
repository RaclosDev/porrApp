import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Trophy,
  Users,
  Calendar,
  PenTool,
  GitBranch,
  LayoutGrid,
  BookOpen,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

/**
 * Barra de navegación inferior móvil (Bottom Navigation Bar)
 * Diseñada para ergonomía de uso con una sola mano en smartphones, con
 * iconos vectoriales SVG de alta definición, efectos de cristal translúcido (glassmorphism)
 * e indicador visual de sección activa.
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
        { to: '/cuadro', label: 'Cuadro', icon: GitBranch },
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
          { to: '/bracket', label: 'Mi Porra', icon: PenTool },
          { to: '/cuadro', label: 'Cuadro', icon: GitBranch },
          { to: '/clasificacion', label: 'Ranking', icon: Trophy },
          { to: '/mis-ligas', label: 'Mis Ligas', icon: Users },
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
        height: 'calc(58px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(10, 15, 29, 0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        zIndex: 1000,
        boxShadow: '0 -8px 28px rgba(0, 0, 0, 0.55)',
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
              gap: '3px',
              textDecoration: 'none',
              flex: 1,
              height: '100%',
              color: isActive ? 'var(--accent-cyan, #00d2d3)' : '#94a3b8',
              transition: 'all 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            })}
          >
            {({ isActive }) => (
              <>
                {/* Indicador sutil de tab activo en el borde superior */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      width: '24px',
                      height: '2.5px',
                      borderRadius: '0 0 3px 3px',
                      background: 'var(--accent-cyan, #00d2d3)',
                      boxShadow: '0 0 8px rgba(0, 210, 211, 0.8)',
                    }}
                  />
                )}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    filter: isActive ? 'drop-shadow(0 0 8px rgba(0, 210, 211, 0.5))' : 'none',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <IconComponent
                    size={20}
                    strokeWidth={isActive ? 2.3 : 1.8}
                    color={isActive ? 'var(--accent-cyan, #00d2d3)' : '#94a3b8'}
                  />
                </span>
                <span
                  style={{
                    fontSize: '0.67rem',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.2px',
                    color: isActive ? 'var(--accent-cyan, #00d2d3)' : '#8899a6',
                    transition: 'color 0.15s ease',
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
