import React, { useState } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { leagueNavItems } from './layout/leagueNav';

/**
 * Pulsar la pestaña en la que ya se está sube al principio de la página, como en otras apps.
 * La página hace scroll en la ventana; con movimiento reducido, el salto es instantáneo.
 */
function scrollToTop() {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

/** Navegación inferior en móvil (hasta 768 px); el resalte se desliza a la pestaña activa. */
export default function MobileBottomNav() {
  const { leagueKind, isAuthenticated, userGroups, userGroupsLoaded, isDemoMode } = useAppContext();

  const isDemo = isDemoMode;
  const isNavLocked = isAuthenticated && userGroupsLoaded && userGroups.length === 0 && !isDemo;
  const navItems = leagueNavItems(leagueKind, isDemo) ?? [];

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

  // Hasta saber la clase de la liga activa no se sabe qué pestañas lleva: se reserva el hueco en
  // vez de enseñar las de otra clase y cambiarlas al momento.
  if (leagueKind === 'loading') {
    return (
      <nav
        className="mobile-bottom-nav floating-capsule-nav fixed bottom-[calc(14px_+_env(safe-area-inset-bottom,_0px))] left-[50%] [transform:translateX(-50%)] w-[calc(100%_-_24px)] max-w-107.5 h-15.5 flex items-center justify-around py-0 px-1.5 z-[1000]"
        aria-label="Navegación principal móvil"
        aria-busy="true"
      >
        {[0, 1, 2, 3, 4].map((slot) => (
          <span
            key={slot}
            className="flex flex-1 flex-col items-center justify-center gap-1.5 h-12.5"
            aria-hidden="true"
          >
            <span className="chrome-placeholder w-5 h-5 rounded-md" />
            <span className="chrome-placeholder w-9 h-2 rounded-sm" />
          </span>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className={`mobile-bottom-nav floating-capsule-nav fixed bottom-[calc(14px_+_env(safe-area-inset-bottom,_0px))] left-[50%] [transform:translateX(-50%)] w-[calc(100%_-_24px)] max-w-107.5 h-15.5 flex items-center justify-around py-0 px-1.5 z-[1000]  ${isNavLocked ? 'opacity-[0.45]' : 'opacity-[1]'} ${isNavLocked ? 'pointer-events-none' : 'pointer-events-auto'}`}
      aria-label="Navegación principal móvil"
      inert={isNavLocked}
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
            onClick={(event) => {
              // Solo en la raíz de la pestaña: desde una subpágina (una liga dentro de «Mis
              // Ligas», por ejemplo) la pestaña sigue llevando a su raíz.
              if (!matchPath({ path: item.to, end: true }, pathname)) return;
              event.preventDefault();
              scrollToTop();
            }}
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
                  {item.mobileLabel ?? item.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
