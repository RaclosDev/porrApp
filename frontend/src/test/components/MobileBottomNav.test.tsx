import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileBottomNav from '../../components/MobileBottomNav';

const mockContext = vi.hoisted(() => ({
  activeGroupPoolFormat: null as string | null,
  activeCompetitionFormatType: null as string | null,
  isAuthenticated: true,
  userGroups: [{ id: 1 }],
  userGroupsLoaded: true,
  isDemoMode: false,
  loadingGroup: false,
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => mockContext,
}));

function renderNav() {
  return render(
    <MemoryRouter>
      <MobileBottomNav />
    </MemoryRouter>,
  );
}

describe('MobileBottomNav', () => {
  beforeEach(() => {
    Object.assign(mockContext, {
      activeGroupPoolFormat: null,
      activeCompetitionFormatType: null,
      isDemoMode: false,
      loadingGroup: false,
    });
  });

  it('reserva las pestañas mientras no se sabe el formato de la liga activa', () => {
    mockContext.loadingGroup = true;
    renderNav();

    const nav = screen.getByRole('navigation', { name: 'Navegación principal móvil' });
    expect(nav).toHaveAttribute('aria-busy', 'true');
    // Ni las pestañas del cuadro ni las de jornadas: aún no se sabe cuáles tocan.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(nav.querySelectorAll('.chrome-placeholder')).toHaveLength(10);
  });

  it('con la liga cargada enseña las pestañas de su formato', () => {
    mockContext.activeGroupPoolFormat = 'MATCH_DAY';
    renderNav();

    expect(screen.getByRole('link', { name: 'Jornadas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mi Porra' })).not.toBeInTheDocument();
  });

  it('en la demo no espera a la liga', () => {
    Object.assign(mockContext, { isDemoMode: true, loadingGroup: true });
    renderNav();

    expect(screen.getByRole('link', { name: 'Mi Porra' })).toBeInTheDocument();
  });
});
