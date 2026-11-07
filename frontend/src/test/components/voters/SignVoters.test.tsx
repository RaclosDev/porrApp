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

  it('filtra por opción y muestra el porcentaje de cada una', () => {
    render(
      <MatchVotersModal voters={voters} homeTeam="Madrid" awayTeam="Barça" onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Madrid - Barça' });
    expect(within(dialog).getByRole('button', { name: 'Todos (6)' })).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: '1 · Gana Madrid' })).toHaveTextContent(
      '5 · 83%',
    );
    // Pocos participantes: sin buscador.
    expect(within(dialog).queryByRole('searchbox')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Gana Barça (1)' }));
    expect(within(dialog).queryByRole('region', { name: '1 · Gana Madrid' })).toBeNull();
    expect(within(dialog).getByRole('region', { name: '2 · Gana Barça' })).toHaveTextContent('Ana');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Todos (6)' }));
    expect(within(dialog).getAllByRole('region')).toHaveLength(3);
  });

  it('con mucha gente deja buscar por nombre sin tildes ni mayúsculas', () => {
    const crowd: MatchVoters = {
      matchId: 8,
      home: [voter(1, 'José'), ...[2, 3, 4, 5].map((id) => voter(id))],
      draw: [voter(6, 'Bea')],
      away: [voter(7, 'Ana'), voter(8, 'Josefa')],
    };
    render(
      <MatchVotersModal voters={crowd} homeTeam="Madrid" awayTeam="Barça" onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Madrid - Barça' });
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Buscar participante' }), {
      target: { value: 'JOSE' },
    });

    expect(within(dialog).getAllByRole('region')).toHaveLength(2);
    expect(within(dialog).getByRole('region', { name: '1 · Gana Madrid' })).toHaveTextContent(
      'José',
    );
    expect(within(dialog).getByRole('region', { name: '2 · Gana Barça' })).toHaveTextContent(
      'Josefa',
    );
    expect(within(dialog).queryByText('Bea')).toBeNull();

    fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(within(dialog).getByText('Nadie se llama así.')).toBeInTheDocument();
  });

  it('encabeza la hoja con los escudos, el resultado y el estado del partido', () => {
    render(
      <MatchVotersModal
        voters={voters}
        homeTeam="Málaga"
        awayTeam="Racing Santander"
        homeLogo="/malaga.png"
        awayLogo="/racing.png"
        homeScore={2}
        awayScore={1}
        status="Final"
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Málaga 2 - 1 Racing Santander' });
    expect(dialog.querySelector('.match-voters-score')).toHaveTextContent('2 - 1');
    expect(dialog.querySelector('.match-voters-status')).toHaveTextContent('Final');
    expect(dialog.querySelector('img[src="/malaga.png"]')).not.toBeNull();
    expect(dialog.querySelector('img[src="/racing.png"]')).not.toBeNull();
  });
});
