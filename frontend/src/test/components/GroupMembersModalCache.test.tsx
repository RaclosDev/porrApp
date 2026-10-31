import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupMembersModal from '../../components/GroupMembersModal';
import { leagueScoring } from '../fixtures';

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
  { userId: 1, participantName: 'Ana', paymentStatus: 'PAID', isAdmin: true },
  { userId: 2, participantName: 'Bruno', paymentStatus: 'PENDING', isAdmin: false },
];

describe('GroupMembersModal: invalidación de la caché', () => {
  let client: QueryClient;
  let invalidated: unknown[][];

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidated = [];
    const original = client.invalidateQueries.bind(client);
    vi.spyOn(client, 'invalidateQueries').mockImplementation((filters, options) => {
      invalidated.push([...(filters?.queryKey ?? [])]);
      return original(filters, options);
    });
    api.fetchGroupMembers.mockReset().mockResolvedValue(MEMBERS);
    api.kickGroupMember.mockReset().mockResolvedValue({ status: 'success' });
    api.regenerateGroupJoinCode.mockReset().mockResolvedValue({ joinCode: 'NEW123' });
    api.fetchLeagueScoring.mockReset().mockResolvedValue(leagueScoring());
    api.updateLeagueScoring.mockReset();
  });

  const setup = () =>
    render(
      <QueryClientProvider client={client}>
        <GroupMembersModal
          groupId={1}
          groupName="Liga de prueba"
          currentJoinCode="ABC123"
          isAdmin
          currentUserId={1}
          initialRules=""
          onClose={vi.fn()}
          onCodeRegenerated={vi.fn()}
          onUploadImage={vi.fn(async () => {})}
          onRemoveImage={vi.fn(async () => {})}
          onSaveSettings={vi.fn().mockResolvedValue(true)}
          onDelete={vi.fn().mockResolvedValue(true)}
        />
      </QueryClientProvider>,
    );

  it('al expulsar invalida miembros, ranking, pronósticos de la liga y myGroups', async () => {
    setup();
    await screen.findByText('Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Expulsar a Bruno' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));

    await waitFor(() => expect(invalidated).toContainEqual(['predictions', '1']));
    expect(invalidated).toContainEqual(['groupMembers', '1']);
    expect(invalidated).toContainEqual(['leaderboard']);
    expect(invalidated).toContainEqual(['myGroups']);
  });

  it('al regenerar el código invalida myGroups y la liga', async () => {
    setup();
    await screen.findByText('Bruno');
    fireEvent.click(screen.getByRole('button', { name: /Regenerar código/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerar' }));

    await waitFor(() => expect(invalidated).toContainEqual(['group', '1']));
    expect(invalidated).toContainEqual(['myGroups']);
  });
  it('keeps both rows locked and rolls back only the failed member', async () => {
    const members = [
      ...MEMBERS,
      { userId: 3, participantName: 'Carla', paymentStatus: 'PENDING', isAdmin: false },
    ];
    api.fetchGroupMembers.mockResolvedValue(members);
    let failBruno!: (error: Error) => void;
    let finishCarla!: () => void;
    api.toggleGroupMemberPayment.mockImplementation((_group: number, userId: number) =>
      userId === 2
        ? new Promise((_resolve, reject) => {
            failBruno = reject;
          })
        : new Promise<void>((resolve) => {
            finishCarla = resolve;
          }),
    );
    setup();
    const bruno = await screen.findByRole('button', {
      name: 'Marcar el pago de Bruno como recibido',
    });
    fireEvent.click(bruno);
    await waitFor(() => expect(api.toggleGroupMemberPayment).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar el pago de Carla como recibido' }));
    await waitFor(() => expect(api.toggleGroupMemberPayment).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole('button', { name: 'Marcar el pago de Bruno como pendiente' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Marcar el pago de Carla como pendiente' }),
    ).toBeDisabled();
    await act(async () => {
      failBruno(new Error('Failed'));
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Marcar el pago de Bruno como recibido' }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole('button', { name: 'Marcar el pago de Carla como pendiente' }),
    ).toBeDisabled();
    api.fetchGroupMembers.mockResolvedValue(
      members.map((m) => (m.userId === 3 ? { ...m, paymentStatus: 'PAID' } : m)),
    );
    await act(async () => {
      finishCarla();
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Marcar el pago de Carla como pendiente' }),
      ).toBeEnabled(),
    );
  });
});
