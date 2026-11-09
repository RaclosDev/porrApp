import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import ActiveLeagueDropdown from '../../components/ActiveLeagueDropdown';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useUnsavedChangesStore } from '../../utils/unsavedChanges';
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
  beforeEach(() => {
    mockChangeGroup.mockClear();
    mockNavigate.mockClear();
    useUnsavedChangesStore.setState({ pending: new Map() });
  });

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

  describe('con cambios de predicción sin guardar', () => {
    const openMenuAndPickOtherLeague = () => {
      render(
        <MemoryRouter>
          <ConfirmDialog />
          <ActiveLeagueDropdown />
        </MemoryRouter>,
      );
      useUnsavedChangesStore.setState({
        pending: new Map([[Symbol('unsaved'), 'Tu predicción tiene cambios sin guardar.']]),
      });
      fireEvent.click(screen.getByRole('button', { name: /Peña Madridista/i }));
      fireEvent.click(screen.getByText('Amigos Mundial 2026'));
    };

    it('pregunta antes de cambiar de liga y «Seguir aquí» se queda en la actual', async () => {
      openMenuAndPickOtherLeague();

      const dialog = await screen.findByRole('alertdialog', { name: '¿Salir sin guardar?' });
      expect(dialog).toHaveAccessibleDescription('Tu predicción tiene cambios sin guardar.');
      expect(mockChangeGroup).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Seguir aquí' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(mockChangeGroup).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(useUnsavedChangesStore.getState().pending.size).toBe(1);
    });

    it('«Salir» cambia de liga y no vuelve a preguntar al ir al inicio', async () => {
      openMenuAndPickOtherLeague();

      fireEvent.click(await screen.findByRole('button', { name: 'Salir' }));

      await waitFor(() => expect(mockChangeGroup).toHaveBeenCalledWith('2'));
      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(useUnsavedChangesStore.getState().pending.size).toBe(0);
    });
  });
});
