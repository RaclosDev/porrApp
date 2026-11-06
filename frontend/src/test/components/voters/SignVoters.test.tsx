import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SignVoters from '../../../components/voters/SignVoters';
import MatchVotersModal from '../../../components/voters/MatchVotersModal';
import type { MatchVoter, MatchVoters } from '../../../types/api';

const voter = (userId: number, name = `Miembro ${userId}`): MatchVoter => ({
  userId,
  name,
  avatarUrl: null,
});

const voters: MatchVoters = {
  matchId: 7,
  home: [1, 2, 3, 4, 5].map((id) => voter(id)),
  draw: [],
  away: [voter(9, 'Ana')],
};

describe('SignVoters', () => {
  it('muestra tres fotos por signo y resume el resto en +N', () => {
    const onOpen = vi.fn();
    render(<SignVoters voters={voters} matchName="Madrid - Barça" onOpen={onOpen} />);

    const home = screen.getByRole('button', {
      name: 'Ver quién ha votado 1 en Madrid - Barça (5)',
    });
    expect(home).toHaveTextContent('+2');
    expect(home.querySelectorAll('.sign-voters-avatar')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /votado X/ })).toBeNull();
    expect(screen.getByRole('button', { name: /votado 2/ })).not.toHaveTextContent('+');

    fireEvent.click(home);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('SignVoters en cruces de cuadro', () => {
  it('solo tiene dos columnas, una por equipo', () => {
    const { container } = render(
      <SignVoters voters={voters} matchName="T1 - G2" onOpen={() => {}} twoWay />,
    );
    expect(container.querySelector('.sign-voters')).toHaveClass('is-two-way');
    expect(container.querySelectorAll('.sign-voters-cell')).toHaveLength(2);
  });
});

describe('MatchVotersModal', () => {
  it('lista a quién ha votado cada opción', () => {
    render(
      <MatchVotersModal voters={voters} homeTeam="Madrid" awayTeam="Barça" onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Madrid - Barça' });
    const home = within(dialog).getByRole('region', { name: '1 · Gana Madrid' });
    expect(within(home).getAllByRole('listitem')).toHaveLength(5);
    expect(within(dialog).getByRole('region', { name: 'X · Empate' })).toHaveTextContent('Nadie');
    expect(within(dialog).getByRole('region', { name: '2 · Gana Barça' })).toHaveTextContent('Ana');
  });

  it('no pinta nada sin partido elegido', () => {
    render(<MatchVotersModal voters={null} homeTeam="" awayTeam="" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
