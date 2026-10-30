import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Trophy,
  Users,
  Calendar,
  Pencil,
  Swords,
  LayoutGrid,
  ListOrdered,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

/**
 * Barra de navegación móvil estilo "Isla Flotante" / "Cápsula" (Floating Dock)
 * Elevada respecto al fondo, centrada con bordes redondeados y efecto glassmorphic.
 * Proporciona acceso ergonómico sin sensación de pie de página tosco.
 */
export default function MobileBottomNav() {
  const {
    activeGroupPoolFormat,
    activeCompetitionFormatType,
    isAuthenticated,
    userGroups,
    userGroupsLoaded,
    isDemoMode,
  } = useAppContext();

  const isDemo = isDemoMode;
  const isNavLocked = isAuthenticated && userGroupsLoaded && userGroups.length === 0 && !isDemo;
  const isMatchDay =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  const navItems = isDemo
    ? [
        { to: '/demo', label: 'Inicio', icon: Home },
        { to: '/prediction', label: 'Mi Porra', icon: Pencil },
        { to: '/bracket', label: 'Resultados', icon: Swords },
        { to: '/grupos', label: 'Grupos', icon: LayoutGrid },
        { to: '/ranking', label: 'Ranking', icon: Trophy },
      ]
    : isMatchDay
      ? [
          { to: '/', label: 'Inicio', icon: Home, end: true },
          { to: '/jornadas', label: 'Jornadas', icon: Calendar },
          { to: '/ranking', label: 'Ranking', icon: Trophy },
          { to: '/tabla', label: 'Tabla', icon: ListOrdered },
          { to: '/mis-ligas', label: 'Mis Ligas', icon: Users },
        ]
      : [
          { to: '/', label: 'Inicio', icon: Home, end: true },
          { to: '/prediction', label: 'Mi Porra', icon: Pencil },
          { to: '/bracket', label: 'Resultados', icon: Swords },
          { to: '/ranking', label: 'Ranking', icon: Trophy },
          { to: '/mis-ligas', label: 'Mis Ligas', icon: Users },
        ];

  return (
    <nav
      className={`mobile-bottom-nav floating-capsule-nav fixed bottom-[calc(14px_+_env(safe-area-inset-bottom,_0px))] left-[50%] [transform:translateX(-50%)] w-[calc(100%_-_24px)] max-w-107.5 h-15.5 bg-[rgba(12,_18,_34,_0.88)] bg-none [backdrop-filter:blur(24px)_saturate(190%)] border border-[rgba(255,_255,_255,_0.12)] rounded-[32px] flex items-center justify-around py-0 px-1.5 z-[1000] shadow-[0_16px_36px_-4px_rgba(0,_0,_0,_0.65),_0_0_0_1px_rgba(255,_255,_255,_0.05),_inset_0_1px_0_rgba(255,_255,_255,_0.15)] ${isNavLocked ? 'opacity-[0.45]' : 'opacity-[1]'} ${isNavLocked ? 'pointer-events-none' : 'pointer-events-auto'}`}
      aria-label="Navegación principal móvil"
      inert={isNavLocked}
      aria-disabled={isNavLocked || undefined}
      style={{ WebkitBackdropFilter: 'blur(24px) saturate(190%)' }}
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
                  className={`flex items-center justify-center leading-[1] [transition:transform_0.2s_ease] ${isActive ? '[filter:drop-shadow(0_0_8px_rgba(0,_210,_211,_0.55))]' : '[filter:none]'} ${isActive ? '[transform:scale(1.08)]' : '[transform:scale(1)]'}`}
                >
                  <IconComponent
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    color={isActive ? 'var(--accent-cyan, #00d2d3)' : '#94a3b8'}
                  />
                </span>
                <span
                  className={`text-[0.64rem] tracking-[0.2px] [transition:color_0.2s_ease] ${isActive ? 'font-bold' : 'font-medium'} ${isActive ? 'text-cyan' : 'text-[#8899a6]'}`}
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
