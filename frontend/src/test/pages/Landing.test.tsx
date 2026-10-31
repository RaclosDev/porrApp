import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Landing from '../../pages/Landing';
import { useLandingData } from '../../hooks/useLandingData';

vi.mock('../../hooks/useLandingData', () => ({
  useLandingData: vi.fn(),
}));

const data = {
  leaders: [
    { rank: 1, userId: 10, name: 'Xegami', avatarUrl: null, total: 1905 },
    { rank: 2, userId: 11, name: 'Gonza', avatarUrl: null, total: 1680 },
    { rank: 3, userId: 12, name: 'Raclos', avatarUrl: null, total: 1500 },
    { rank: 4, userId: 13, name: 'Ana', avatarUrl: null, total: 1400 },
  ],
  participants: 21,
  champion: { team: 'España', count: 17, total: 21 },
  nextFixtures: [],
  loading: false,
  error: false,
};

describe('Landing', () => {
  beforeEach(() => {
    vi.mocked(useLandingData).mockReturnValue(data);
  });

  const renderLanding = () =>
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

  it('shows the real leaders and the most picked champion', () => {
    renderLanding();
    expect(screen.getAllByText('Xegami').length).toBeGreaterThan(0);
    expect(screen.getByText('Va primero de 21 en la Porra Global')).toBeInTheDocument();
    expect(screen.getByText('España campeona en 17 de 21 cuadros')).toBeInTheDocument();
  });

  it('opens the login modal from the main button and links to the demo', () => {
    const onOpen = vi.fn();
    window.addEventListener('open-login-modal', onOpen);
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar con Google' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Ver la porra del Mundial' })).toHaveAttribute(
      'href',
      '/demo',
    );
    window.removeEventListener('open-login-modal', onOpen);
  });

  it('shows only the top three in the hero podium and keeps the album accessible', () => {
    renderLanding();
    const podium = screen.getByRole('list', { name: 'Podio de la Porra Global' });
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3);
    for (const name of ['Xegami', 'Gonza', 'Raclos']) {
      expect(within(podium).getByText(name)).toBeInTheDocument();
    }
    expect(within(podium).queryByText('Ana')).not.toBeInTheDocument();
    const album = screen.getByRole('list', { name: 'Cromos de la Porra Global' });
    expect(within(album).getAllByRole('listitem')).toHaveLength(4);
    expect(album).toHaveAttribute('tabindex', '0');
  });

  it('tells the visitor when the ranking is not available', () => {
    vi.mocked(useLandingData).mockReturnValue({
      ...data,
      leaders: [],
      champion: null,
      error: true,
    });
    renderLanding();
    expect(screen.getByRole('status')).toHaveTextContent('La clasificación no responde');
  });
});
