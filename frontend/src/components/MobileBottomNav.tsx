import React, { useState } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router-dom';
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

/** Navegación inferior en móvil (hasta 768 px); el resalte se desliza a la pestaña activa. */
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

  const { pathname } = useLocation();
  const activeIndex = navItems.findIndex((item) =>
    matchPath({ path: item.to, end: item.end ?? false }, pathname),
  );
  // Si la ruta no tiene pestaña, el indicador se oculta en la última posición para que al
  // volver salga de ahí y no desde la primera pestaña.
  const [lastActiveIndex, setLastActiveIndex] = useState(Math.max(activeIndex, 0));
  if (activeIndex !== -1 && activeIndex !== lastActiveIndex) {
    setLastActiveIndex(activeIndex);
  }
  const indicatorIndex = activeIndex === -1 ? lastActiveIndex : activeIndex;

  return (
    <nav
      className={`mobile-bottom-nav floating-capsule-nav fixed bottom-[calc(14px_+_env(safe-area-inset-bottom,_0px))] left-[50%] [transform:translateX(-50%)] w-[calc(100%_-_24px)] max-w-107.5 h-15.5 flex items-center justify-around py-0 px-1.5 z-[1000]  ${isNavLocked ? 'opacity-[0.45]' : 'opacity-[1]'} ${isNavLocked ? 'pointer-events-none' : 'pointer-events-auto'}`}
      aria-label="Navegación principal móvil"
      inert={isNavLocked}
      aria-disabled={isNavLocked || undefined}
      style={
        {
          '--nav-active': indicatorIndex,
          '--nav-count': navItems.length,
        } as React.CSSProperties
      }
    >
      <span
        className={`mobile-nav-indicator ${activeIndex === -1 ? 'is-hidden' : ''}`}
        aria-hidden="true"
      />
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
              color: isActive ? 'var(--ink)' : '#94a3b8',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              WebkitTapHighlightColor: 'transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center justify-center leading-[1]">
                  <IconComponent
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    color={isActive ? 'var(--ink)' : '#94a3b8'}
                  />
                </span>
                <span
                  className={`text-[0.64rem] tracking-[0.2px] [transition:color_0.2s_ease] ${isActive ? 'font-bold' : 'font-medium'} ${isActive ? 'text-[#111827]' : 'text-[#94a3b8]'}`}
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
