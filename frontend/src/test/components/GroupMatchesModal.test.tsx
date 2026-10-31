import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import GroupMatchesModal from '../../components/GroupMatchesModal';
import { game } from '../fixtures';

it('distinguishes live, unknown dates, postponements and finished matches without null scores', () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  const { baseElement } = render(
    <GroupMatchesModal
      selectedGroup={{ name: 'A', teams: [{ name: 'Local' }, { name: 'Visitante' }] }}
      onClose={vi.fn()}
      allGames={[
        game({ id: 1, home: 'Local', away: 'Visitante', date: null }),
        game({
          id: 2,
          home: 'Local',
          away: 'Visitante',
          date: '2000-01-01',
          status: 'LIVE',
          homeScore: 1,
          awayScore: 0,
        }),
        game({ id: 3, home: 'Local', away: 'Visitante', date: '2000-01-02', status: 'POSTPONED' }),
        game({
          id: 4,
          home: 'Local',
          away: 'Visitante',
          finished: true,
          home_score: 2,
          away_score: 1,
        }),
      ]}
    />,
  );
  expect(screen.getByText(/En directo/)).not.toHaveTextContent('Próx');
  expect(screen.getByText(/Aplazado/)).toBeVisible();
  expect(screen.getAllByText(/Fecha por confirmar/)).toHaveLength(2);
  expect(screen.getByText('1 - 0')).toBeVisible();
  expect(screen.getByText('2 - 1')).toBeVisible();
  expect(baseElement).not.toHaveTextContent('null');
  fireEvent.click(screen.getAllByRole('button', { name: /Abrir el portal de fútbol/ })[0]);
  expect(open).toHaveBeenCalledWith(
    'https://www.sofascore.com/football',
    '_blank',
    'noopener,noreferrer',
  );
  open.mockRestore();
});
