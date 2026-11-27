import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PokerInviteDialog from '../../components/poker/PokerInviteDialog';

const league = { name: 'Sábados', joinCode: 'P0KER8' };

it('la administración abre la organización de torneos a todos los miembros', () => {
  const onEveryoneOrganizes = vi.fn();
  render(
    <PokerInviteDialog
      league={{ ...league, admin: true, everyoneOrganizes: false }}
      onEveryoneOrganizes={onEveryoneOrganizes}
      onClose={() => {}}
    />,
  );
  const toggle = screen.getByRole('switch', { name: /Todos organizan/ });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(onEveryoneOrganizes).toHaveBeenCalledWith(true);
});

it('quien no administra no ve el ajuste', () => {
  render(
    <PokerInviteDialog
      league={{ ...league, admin: false, everyoneOrganizes: true }}
      onEveryoneOrganizes={vi.fn()}
      onClose={() => {}}
    />,
  );
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
