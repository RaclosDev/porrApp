import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GroupMembersModal from '../../components/GroupMembersModal';
import { DEFAULT_SCORING, leagueScoring } from '../fixtures';

const api = vi.hoisted(() => ({
  fetchGroupMembers: vi.fn(),
  toggleGroupMemberPayment: vi.fn(),
  kickGroupMember: vi.fn(),
  regenerateGroupJoinCode: vi.fn(),
  fetchLeagueScoring: vi.fn(),
  updateLeagueScoring: vi.fn(),
}));

vi.mock('../../services/api', () => api);

const MEMBERS = [
  {
    userId: 1,
    participantName: 'Ana',
    paymentStatus: 'PAID',
    isAdmin: true,
    avatarUrl: null,
  },
  {
    userId: 2,
    participantName: 'Bruno',
    paymentStatus: 'PENDING',
    isAdmin: false,
    avatarUrl: null,
  },
];

describe('GroupMembersModal', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.fetchGroupMembers.mockReset().mockResolvedValue(MEMBERS);
    api.toggleGroupMemberPayment.mockReset().mockResolvedValue({ paymentStatus: 'PAID' });
    api.kickGroupMember.mockReset().mockResolvedValue({ status: 'success' });
    api.regenerateGroupJoinCode.mockReset().mockResolvedValue({ joinCode: 'NEW123' });
    api.fetchLeagueScoring.mockReset().mockResolvedValue(leagueScoring());
    api.updateLeagueScoring.mockReset();
  });

  const setup = (props: Partial<Parameters<typeof GroupMembersModal>[0]> = {}) => {
    const onSaveSettings = vi.fn().mockResolvedValue(true);
    const onDelete = vi.fn().mockResolvedValue(true);
    const utils = render(
      <QueryClientProvider client={queryClient}>
        <GroupMembersModal
          groupId={1}
          groupName="Liga de prueba"
          currentJoinCode="ABC123"
          isAdmin
          currentUserId={1}
          initialRules="Cuota de 10 €"
          onClose={vi.fn()}
          onCodeRegenerated={vi.fn()}
          onUploadImage={vi.fn(async () => {})}
          onRemoveImage={vi.fn(async () => {})}
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
    fireEvent.click(screen.getByRole('tab', { name: 'Normas' }));
    fireEvent.change(screen.getByLabelText('Normas de la liga'), {
      target: { value: 'Cuota de 15 €' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() =>
      expect(onSaveSettings).toHaveBeenCalledWith({
        name: 'Liga renovada',
        rules: 'Cuota de 15 €',
      }),
    );
    expect(api.updateLeagueScoring).not.toHaveBeenCalled();
  });

  it('edita la puntuación y la guarda completa sin tocar nombre ni normas', async () => {
    api.updateLeagueScoring.mockImplementation((_id, rules) =>
      Promise.resolve(leagueScoring({ rules })),
    );
    const { onSaveSettings } = setup();
    await screen.findByText('Bruno');

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/i }));
    expect(screen.getByRole('tab', { name: /Puntuación/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.change(await screen.findByLabelText('Campeón'), { target: { value: '300' } });
    expect(screen.getByText('Por defecto: 200')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() =>
      expect(api.updateLeagueScoring).toHaveBeenCalledWith(1, {
        ...DEFAULT_SCORING,
        championPoints: 300,
      }),
    );
    expect(onSaveSettings).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Guardar cambios/i })).not.toBeInTheDocument(),
    );
  });

  it('blocks settings edits and closing until the pending save finishes', async () => {
    let finish!: (saved: boolean) => void;
    const onSaveSettings = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn();
    setup({ onSaveSettings, onClose });
    await screen.findByText('Bruno');
    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/i }));
    fireEvent.change(screen.getByLabelText('Nombre de la liga'), {
      target: { value: 'Nueva liga' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));
    await waitFor(() => expect(onSaveSettings).toHaveBeenCalled());
    expect(screen.getByLabelText('Nombre de la liga')).toBeDisabled();
    expect(screen.getByLabelText('Campeón')).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    finish(true);
    await waitFor(() => expect(screen.getByLabelText('Nombre de la liga')).toBeEnabled());
    expect(screen.getByLabelText('Nombre de la liga')).toHaveValue('Nueva liga');
  });

  it('no deja guardar un valor no válido y restaura los valores por defecto', async () => {
    api.fetchLeagueScoring.mockResolvedValue(
      leagueScoring({
        poolFormat: 'MATCH_DAY',
        rules: { ...DEFAULT_SCORING, exactScorePoints: 10 },
      }),
    );
    setup();
    await screen.findByText('Bruno');
    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/i }));

    const exact = await screen.findByLabelText('Resultado exacto');
    expect(exact).toHaveValue(10);
    expect(exact).toBeDisabled();
    expect(screen.getByLabelText('Bonus por diferencia de goles')).toBeDisabled();
    expect(screen.queryByLabelText('Campeón')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Signo 1X2'), { target: { value: '-2' } });
    expect(screen.getByText('Escribe un número entero, 0 o más.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Signo 1X2'), { target: { value: '1001' } });
    expect(screen.getByText('Como máximo 1000.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Restaurar valores por defecto/i }));
    expect(screen.getByLabelText('Resultado exacto')).toHaveValue(5);
    expect(screen.getByLabelText('Signo 1X2')).toHaveValue(3);
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Restaurar valores por defecto/i })).toBeDisabled();
  });

  it('muestra la puntuación fija, sin campos, cuando la liga no se puede cambiar', async () => {
    api.fetchLeagueScoring.mockResolvedValue(leagueScoring({ editable: false }));
    setup();
    await screen.findByText('Bruno');
    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/i }));

    expect(
      await screen.findByText('La puntuación de esta liga es fija y no se puede cambiar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('Campeón')).toBeInTheDocument();
  });

  it('marca un pago como recibido desde la fila del miembro', async () => {
    setup();
    await screen.findByText('Bruno');

    fireEvent.click(
      screen.getByRole('button', {
        name: /Marcar el pago de Bruno como recibido/i,
      }),
    );

    await waitFor(() => expect(api.toggleGroupMemberPayment).toHaveBeenCalledWith(1, 2, 'PAID'));
  });

  it('pide confirmación en línea antes de expulsar a un miembro', async () => {
    setup();
    await screen.findByText('Bruno');

    fireEvent.click(screen.getByRole('button', { name: 'Expulsar a Bruno' }));
    expect(screen.getByText('¿Expulsar?')).toBeInTheDocument();
    expect(api.kickGroupMember).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(api.kickGroupMember).toHaveBeenCalledWith(1, 2));
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
