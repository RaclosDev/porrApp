import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import GroupsDashboard from '../../pages/GroupsDashboard';
import type GroupMembersModal from '../../components/GroupMembersModal';
import { useAppContext } from '../../context/AppContext';
import {
  fetchMyGroups,
  fetchCompetitions,
  uploadGroupImage,
  deleteGroupImage,
} from '../../services/api';
import { appContext, group } from '../context/fixtures';
vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', async (original) => ({
  ...(await original<typeof import('../../services/api')>()),
  fetchMyGroups: vi.fn(),
  fetchCompetitions: vi.fn(),
  uploadGroupImage: vi.fn(),
  deleteGroupImage: vi.fn(),
}));
vi.mock('../../components/GroupMembersModal', () => ({
  default: (props: Parameters<typeof GroupMembersModal>[0]) => (
    <div role="dialog">
      <span>{props.imageUrl}</span>
      <button onClick={() => void props.onUploadImage(new Blob())}>Subir</button>
      <button onClick={() => void props.onRemoveImage()}>Quitar</button>
      <button onClick={props.onClose}>Cerrar prueba</button>
    </div>
  ),
}));

it.each(['upload', 'remove'] as const)(
  'does not apply late %s from league A to the modal of B',
  async (operation) => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.mocked(uploadGroupImage).mockReturnValue(
      pending.then(() => ({ status: 'success', imageUrl: '/a-new.png' })),
    );
    vi.mocked(deleteGroupImage).mockReturnValue(
      pending.then(() => ({ status: 'success', imageUrl: null })),
    );
    vi.mocked(useAppContext).mockReturnValue(
      appContext({ isAuthenticated: true, userId: '1', userName: 'Ana' }),
    );
    vi.mocked(fetchMyGroups).mockResolvedValue([
      group({ id: 1, name: 'Liga A', adminUserId: 1, imageUrl: '/a.png' }),
      group({ id: 2, name: 'Liga B', adminUserId: 1, imageUrl: '/b.png' }),
    ]);
    vi.mocked(fetchCompetitions).mockResolvedValue([]);
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <GroupsDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Administrar Liga A' }));
    fireEvent.click(
      screen.getByRole('button', { name: operation === 'upload' ? 'Subir' : 'Quitar' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Administrar Liga B' }));
    await act(async () => {
      finish();
      await pending;
    });
    expect(screen.getByRole('dialog')).toHaveTextContent('/b.png');
  },
);
