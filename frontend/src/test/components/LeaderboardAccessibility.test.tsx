import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import Leaderboard from '../../pages/Leaderboard';
import { appContext, participantScore } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));

describe('Leaderboard accessibility', () => {
  it('exposes focusable sorting controls and the current sort direction', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '1',
        activeGroupPoolFormat: 'MATCH_DAY',
        leaderboardData: [participantScore({ name: 'Carlos', total: 25 })],
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );
    const total = screen.getByRole('button', { name: 'Ordenar por Total' });
    total.focus();
    expect(total).toHaveFocus();
    expect(total.closest('th')).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(total);
    expect(total.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    const matchday = screen.getByRole('button', { name: 'Ordenar por Puntos de jornada' });
    fireEvent.click(matchday);
    expect(matchday.closest('th')).toHaveAttribute('aria-sort', 'descending');
    expect(total.closest('th')).toHaveAttribute('aria-sort', 'none');
    expect(container.querySelector('#share-image-template')).toHaveAttribute('aria-hidden', 'true');
  });
});
