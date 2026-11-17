import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DemoBar from '../../demo/DemoBar';
import { useAppStore } from '../../store/useAppStore';

const leaveDemo = vi.hoisted(() => vi.fn());
vi.mock('../../demo/mode', async (original) => ({
  ...(await original<typeof import('../../demo/mode')>()),
  leaveDemo,
}));

describe('DemoBar', () => {
  it('cambia de liga, vuelve al inicio y deja salir', () => {
    useAppStore.setState({ activeGroupId: '1' });
    render(
      <MemoryRouter initialEntries={['/ranking']}>
        <DemoBar />
        <Routes>
          <Route path="/" element={<p>inicio</p>} />
          <Route path="*" element={<p>otra</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/datos ficticios/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mundial' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'UFC' }));
    expect(useAppStore.getState().activeGroupId).toBe('39');
    expect(screen.getByRole('button', { name: 'UFC' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('inicio')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(leaveDemo).toHaveBeenCalled();
  });
});
