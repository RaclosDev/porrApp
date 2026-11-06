import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeagueParticipantsDialog from '../../../components/league/LeagueParticipantsDialog';

const api = vi.hoisted(() => ({ fetchGroupMembers: vi.fn() }));
vi.mock('../../../services/api', () => api);

const renderDialog = (onClose = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LeagueParticipantsDialog groupId={5} groupName="Tebas League" onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
};

describe('LeagueParticipantsDialog', () => {
  beforeEach(() => {
    api.fetchGroupMembers.mockReset().mockResolvedValue([
      {
        userId: 2,
        participantName: 'bruno',
        isAdmin: false,
        avatarUrl: null,
        paymentStatus: 'PENDING',
      },
      { userId: 1, participantName: 'Ana', isAdmin: true, avatarUrl: null, paymentStatus: 'PAID' },
    ]);
  });

  it('lista a los miembros por nombre, marca al admin y no muestra pagos', async () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Participantes' });
    expect(within(dialog).getByText('Tebas League')).toBeInTheDocument();
    const items = await within(dialog).findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['AnaAdmin', 'bruno']);
    expect(within(dialog).getByText('2 participantes en la liga')).toBeInTheDocument();
    expect(within(dialog).queryByText(/pag/i)).toBeNull();
    expect(api.fetchGroupMembers).toHaveBeenCalledWith(5);
  });

  it('se cierra con Escape y al pulsar fuera', async () => {
    const onClose = renderDialog();
    await screen.findAllByRole('listitem');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('avisa si no se puede cargar la lista', async () => {
    api.fetchGroupMembers.mockReset().mockRejectedValue(new Error('403'));
    renderDialog();

    expect(
      await screen.findByText('No se ha podido cargar la lista de participantes.'),
    ).toBeInTheDocument();
  });
});
