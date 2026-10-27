import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ActiveLeagueDropdown from '../../components/ActiveLeagueDropdown';

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
        competitionName: 'LaLiga',
        imageUrl: '/api/groups/1/image?v=9',
      },
      { id: 2, name: 'Sin imagen', competitionName: 'FIFA World Cup 2026' },
    ],
    changeGroup: vi.fn(),
    isAuthenticated: true,
  }),
}));

describe('ActiveLeagueDropdown con imágenes de liga', () => {
  it('muestra la imagen de la liga activa y de cada liga del selector, con emoji como respaldo', () => {
    const { container } = render(
      <MemoryRouter>
        <ActiveLeagueDropdown />
      </MemoryRouter>,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/groups/1/image?v=9');

    fireEvent.click(screen.getByRole('button', { name: /Peña Madridista/i }));
    expect(container.querySelectorAll('img').length).toBe(2); // activa + primera fila
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();
    expect(screen.getByText('🌍')).toBeInTheDocument(); // respaldo de la liga sin imagen
  });
});
