import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import PokerPlayersDialog from '../../components/poker/PokerPlayersDialog';

const player = (id: number, name: string, guest: boolean) => ({
  id,
  name,
  guest,
  userId: guest ? null : id,
  avatarUrl: null,
});

it('lista a todos los jugadores por nombre y marca a los invitados', () => {
  render(
    <PokerPlayersDialog
      players={[player(1, 'Zoe', false), player(2, 'Ana', true), player(3, 'Luis', false)]}
      leagueName="Sábados"
      onClose={() => {}}
    />,
  );
  expect(screen.getByText('3 jugadores: 2 con cuenta y 1 invitado')).toBeInTheDocument();
  const rows = screen.getAllByRole('listitem').map((row) => row.textContent);
  expect(rows[0]).toMatch(/Ana.*Invitado/);
  expect(rows[1]).toMatch(/Luis$/);
  expect(rows[2]).toMatch(/Zoe$/);
});
