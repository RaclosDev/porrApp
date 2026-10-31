import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  { userId: 'u1', participantName: 'Ana', paymentStatus: 'PAID', isAdmin: true },
  { userId: 'u2', participantName: 'Bruno', paymentStatus: 'PENDING', isAdmin: false },
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
          currentUserId="u1"
          initialRules=""
          onClose={vi.fn()}
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
});
