import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ActiveLeagueDropdown from '../../components/ActiveLeagueDropdown';
import { MemoryRouter } from 'react-router-dom';

const mockChangeGroup = vi.fn();
const mockNavigate = vi.fn();

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
  }),
}));

describe('ActiveLeagueDropdown Component', () => {
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
});
