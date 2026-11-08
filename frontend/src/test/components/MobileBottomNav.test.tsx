import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileBottomNav from '../../components/MobileBottomNav';
import MainNav from '../../components/layout/MainNav';
import { leagueNavItems, showsFillBracketButton } from '../../components/layout/leagueNav';
import { LEAGUE_KINDS, type LeagueKind } from '../../context/leagueKind';

const mockContext = vi.hoisted(() => ({
  leagueKind: 'loading' as string,
  isAuthenticated: true,
  userGroups: [{ id: 1 }],
  userGroupsLoaded: true,
  isDemoMode: false,
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => mockContext,
}));

/** Secciones de cada clase de liga, en el orden de la barra. `null`: aún no se sabe. */
const EXPECTED: Record<LeagueKind, string[] | null> = {
  loading: null,
  error: ['Inicio', 'Mis Ligas'],
  none: ['Inicio', 'Mis Ligas'],
  unknown: ['Inicio', 'Ranking', 'Mis Ligas'],
  worldCup: ['Inicio', 'Mi Porra', 'Resultados', 'Ranking', 'Mis Ligas'],
  customBracket: ['Inicio', 'Mi Porra', 'Resultados', 'Ranking', 'Mis Ligas'],
  ownBracket: ['Inicio', 'Mi Porra', 'Resultados', 'Ranking', 'Mis Ligas'],
  knockoutDraw: ['Inicio', 'Mi Porra', 'Resultados', 'Ranking', 'Mis Ligas'],
  matchday: ['Inicio', 'Jornadas', 'Ranking', 'Tabla', 'Mis Ligas'],
  fightCard: ['Inicio', 'Jornadas', 'Ranking', 'Cartelera', 'Mis Ligas'],
  tennisDraw: ['Inicio', 'Jornadas', 'Ranking', 'Cuadro', 'Mis Ligas'],
  grandPrix: ['Carreras', 'Ranking', 'Mundial', 'Mis Ligas'],
};

const renderMobile = () =>
  render(
    <MemoryRouter>
      <MobileBottomNav />
    </MemoryRouter>,
  );

describe('Navegación por clase de liga', () => {
  beforeEach(() => {
    Object.assign(mockContext, { leagueKind: 'loading', isDemoMode: false });
  });

  it.each(LEAGUE_KINDS)('la barra del móvil de una liga %s', (kind) => {
    mockContext.leagueKind = kind;
    renderMobile();
    const expected = EXPECTED[kind];
    const nav = screen.getByRole('navigation', { name: 'Navegación principal móvil' });
    if (!expected) {
      // Ni las pestañas del cuadro ni las de jornadas: aún no se sabe cuáles tocan.
      expect(nav).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(nav.querySelectorAll('.chrome-placeholder')).toHaveLength(10);
      return;
    }
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(expected);
  });

  it.each(LEAGUE_KINDS)('la de escritorio de una liga %s', (kind) => {
    const { container } = render(
      <MemoryRouter>
        <MainNav items={leagueNavItems(kind, false)} isNavLocked={false} />
      </MemoryRouter>,
    );
    const expected = EXPECTED[kind]?.map((label) =>
      label === 'Carreras' ? 'Grandes Premios' : label,
    );
    if (!expected) {
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(container.querySelectorAll('.chrome-placeholder')).toHaveLength(5);
      return;
    }
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(expected);
  });

  it.each(LEAGUE_KINDS)('la demo de una liga %s no lleva Mis Ligas y empieza en /demo', (kind) => {
    const items = leagueNavItems(kind, true);
    if (!items) return;
    expect(items.some((item) => item.to === '/mis-ligas')).toBe(false);
    expect(items.some((item) => item.to === '/')).toBe(false);
    // Grupos es la fase de grupos del Mundial: solo en sus ligas.
    expect(items.some((item) => item.to === '/grupos')).toBe(kind === 'worldCup');
  });

  it('en la demo también espera a saber la liga', () => {
    Object.assign(mockContext, { isDemoMode: true, leagueKind: 'loading' });
    renderMobile();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each(LEAGUE_KINDS)('«Rellenar mi porra» en una liga %s', (kind) => {
    const bracket = ['worldCup', 'customBracket', 'ownBracket', 'knockoutDraw'].includes(kind);
    expect(showsFillBracketButton(kind)).toBe(bracket);
  });
});
