import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GroupMembersModal from '../../components/GroupMembersModal';

const api = vi.hoisted(() => ({
  fetchGroupMembers: vi.fn(),
  toggleGroupMemberPayment: vi.fn(),
  kickGroupMember: vi.fn(),
  regenerateGroupJoinCode: vi.fn(),
}));

vi.mock('../../services/api', () => api);

const MEMBERS = [
  {
    userId: 'u1',
    participantName: 'Ana',
    paymentStatus: 'PAID',
    isAdmin: true,
    avatarUrl: null,
  },
  {
    userId: 'u2',
    participantName: 'Bruno',
    paymentStatus: 'PENDING',
    isAdmin: false,
    avatarUrl: null,
  },
];

describe('GroupMembersModal', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.fetchGroupMembers.mockReset().mockResolvedValue(MEMBERS);
    api.toggleGroupMemberPayment.mockReset().mockResolvedValue({ paymentStatus: 'PAID' });
    api.kickGroupMember.mockReset().mockResolvedValue({ status: 'success' });
    api.regenerateGroupJoinCode.mockReset().mockResolvedValue({ joinCode: 'NEW123' });
  });

  const setup = (props = {}) => {
    const onSaveSettings = vi.fn().mockResolvedValue(true);
    const onDelete = vi.fn().mockResolvedValue(true);
    const utils = render(
      <QueryClientProvider client={queryClient}>
        <GroupMembersModal
          groupId="1"
          groupName="Liga de prueba"
          currentJoinCode="ABC123"
          isAdmin
          currentUserId="u1"
          initialRules="Cuota de 10 €"
          onClose={vi.fn()}
          onSaveSettings={onSaveSettings}
          onDelete={onDelete}
          {...props}
        />
      </QueryClientProvider>,
    );
    return { onSaveSettings, onDelete, ...utils };
  };

  it('muestra el resumen de pagos y los miembros con su estado', async () => {
    setup();

    expect(await screen.findByText('Bruno')).toBeInTheDocument();
    expect(screen.getByText('1/2 pagados')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Miembros/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('no muestra pagos cuando la liga no los tiene (Porra Global)', async () => {
    api.fetchGroupMembers.mockResolvedValue(
      MEMBERS.map((member) => ({ ...member, paymentStatus: null })),
    );
    setup({ isAdmin: false });

    expect(await screen.findByText('Bruno')).toBeInTheDocument();
    expect(screen.queryByText('Resumen de pagos')).not.toBeInTheDocument();
    expect(screen.queryByText('Pago pendiente')).not.toBeInTheDocument();
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
  });

  it('guarda nombre y reglas en una sola acción desde Ajustes', async () => {
    const { onSaveSettings } = setup();
    await screen.findByText('Bruno');

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/i }));
    fireEvent.change(screen.getByLabelText('Nombre de la liga'), {
      target: { value: 'Liga renovada' },
    });
    fireEvent.change(screen.getByLabelText('Reglas de la liga'), {
      target: { value: 'Cuota de 15 €' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() =>
      expect(onSaveSettings).toHaveBeenCalledWith({
        name: 'Liga renovada',
        rules: 'Cuota de 15 €',
      }),
    );
  });

  it('marca un pago como recibido desde la fila del miembro', async () => {
    setup();
    await screen.findByText('Bruno');

    fireEvent.click(
      screen.getByRole('button', {
        name: /Marcar el pago de Bruno como recibido/i,
      }),
    );

    await waitFor(() =>
      expect(api.toggleGroupMemberPayment).toHaveBeenCalledWith('1', 'u2', 'PAID'),
    );
  });

  it('pide confirmación en línea antes de expulsar a un miembro', async () => {
    setup();
    await screen.findByText('Bruno');

    fireEvent.click(screen.getByRole('button', { name: 'Expulsar a Bruno' }));
    expect(screen.getByText('¿Expulsar?')).toBeInTheDocument();
    expect(api.kickGroupMember).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(api.kickGroupMember).toHaveBeenCalledWith('1', 'u2'));
  });

  it('solo elimina la liga al escribir su nombre exacto', async () => {
    const { onDelete } = setup();
    await screen.findByText('Bruno');

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Eliminar liga/i }));
    const confirmButton = screen.getByRole('button', { name: /Eliminar definitivamente/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Escribe/i), {
      target: { value: 'Liga de prueba' },
    });
    expect(confirmButton).not.toBeDisabled();
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });
});
