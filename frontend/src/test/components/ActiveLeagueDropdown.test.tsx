import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ActiveLeagueDropdown from '../../components/ActiveLeagueDropdown';
import { MemoryRouter } from 'react-router-dom';

const mockChangeGroup = vi.fn();
const mockNavigate = vi.fn();
const mockState = vi.hoisted(() => ({ userGroupsLoaded: true }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    activeGroupId: 1,
    activeGroupName: 'Peña Madridista',
    activeCompetitionName: 'LaLiga EA Sports',
    activeCompetitionFormatType: 'LEAGUE',
    userGroups: [
      {
        id: 1,
        name: 'Peña Madridista',
        competitionName: 'LaLiga EA Sports',
        poolFormat: 'MATCH_DAY',
      },
      {
        id: 2,
        name: 'Amigos Mundial 2026',
        competitionName: 'FIFA World Cup 2026',
        poolFormat: 'TOURNAMENT',
      },
    ],
    changeGroup: mockChangeGroup,
    isAuthenticated: true,
    userGroupsLoaded: mockState.userGroupsLoaded,
  }),
}));

describe('ActiveLeagueDropdown Component', () => {
  it('reserva el hueco mientras llegan las ligas en vez de enseñar «Crear o unirse»', () => {
    mockState.userGroupsLoaded = false;
    const { container } = render(
      <MemoryRouter>
        <ActiveLeagueDropdown />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Crear o unirse')).not.toBeInTheDocument();
    expect(container.querySelector('.chrome-placeholder')).toHaveAttribute('aria-hidden', 'true');
    mockState.userGroupsLoaded = true;
  });

  it('Despliega el menú al pulsar y ejecuta changeGroup con navegación al inicio y accesibilidad Escape', () => {
    render(
      <MemoryRouter>
        <ActiveLeagueDropdown />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /Peña Madridista/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Amigos Mundial 2026')).toBeInTheDocument();

    // Seleccionar otra liga
    fireEvent.click(screen.getByText('Amigos Mundial 2026'));
    expect(mockChangeGroup).toHaveBeenCalledWith('2');
    expect(mockNavigate).toHaveBeenCalledWith('/');

    // Comprobar cierre con Escape
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('separa crear liga de unirse con código', () => {
    render(
      <MemoryRouter>
        <ActiveLeagueDropdown />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole('button', { name: /Peña Madridista/i });

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Crear liga' }));
    expect(mockNavigate).toHaveBeenCalledWith('/crear-liga');

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Unirse con código' }));
    expect(mockNavigate).toHaveBeenCalledWith('/mis-ligas?unirse');
  });
});
