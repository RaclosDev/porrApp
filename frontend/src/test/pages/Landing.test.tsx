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
  leagueName: 'Liga abierta',
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
    expect(screen.getByText('Va primero de 21 en Liga abierta')).toBeInTheDocument();
    expect(screen.getByText('España campeona en 17 de 21 cuadros')).toBeInTheDocument();
  });

  it('opens the login modal from the hero and the closing call, and links to the demo', () => {
    const onOpen = vi.fn();
    window.addEventListener('open-login-modal', onOpen);
    renderLanding();
    const createButtons = screen.getAllByRole('button', { name: 'Crear mi liga gratis' });
    expect(createButtons).toHaveLength(2);
    createButtons.forEach((button) => fireEvent.click(button));
    expect(onOpen).toHaveBeenCalledTimes(2);
    for (const link of screen.getAllByRole('link', { name: 'Ver una porra de ejemplo' })) {
      expect(link).toHaveAttribute('href', '/demo');
    }
    window.removeEventListener('open-login-modal', onOpen);
  });

  it('explains how to play in three steps', () => {
    renderLanding();
    const steps = screen.getByRole('list', { name: 'Pasos para jugar' });
    expect(
      within(steps)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Crea tu liga', 'Invita con un enlace', 'Predice y compite']);
  });

  it('shows only the top three in the hero podium and every sticker in the album', () => {
    renderLanding();
    const podium = screen.getByRole('list', { name: 'Podio de Liga abierta' });
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3);
    for (const name of ['Xegami', 'Gonza', 'Raclos']) {
      expect(within(podium).getByText(name)).toBeInTheDocument();
    }
    expect(within(podium).queryByText('Ana')).not.toBeInTheDocument();
    const album = screen.getByRole('list', { name: 'Cromos de Liga abierta' });
    expect(within(album).getAllByRole('listitem')).toHaveLength(4);
    // Ya no se desplaza: todos los cromos caben en una fila, así que no hace falta enfocarlo.
    expect(album).not.toHaveAttribute('tabindex');
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
