import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PredictionDemo from '../../components/landing/PredictionDemo';
import { fetchMatches } from '../../services/api';
import type { Match } from '../../types/api';

vi.mock('../../services/api', () => ({ fetchMatches: vi.fn() }));

const renderDemo = () =>
  render(
    <MemoryRouter>
      <PredictionDemo />
    </MemoryRouter>,
  );

const sign = (match: string, value: string) =>
  screen.getByRole('button', { name: `Predecir ${value} en ${match}` });

const match = (id: number, home: string, away: string, round: string, finished = false): Match =>
  ({
    id,
    home,
    away,
    home_team_id: null,
    away_team_id: null,
    homeLogo: null,
    awayLogo: null,
    homeTeamLogo: null,
    awayTeamLogo: null,
    homeScore: finished ? 1 : null,
    awayScore: finished ? 0 : null,
    date: `2099-01-0${id}T20:00:00Z`,
    finished,
    round,
    groupName: null,
    winner: null,
    displayClock: null,
    status: finished ? 'FINISHED' : 'SCHEDULED',
  }) as Match;

describe('PredictionDemo', () => {
  beforeEach(() => {
    // Sin API: la demo tira de la copia guardada.
    vi.mocked(fetchMatches).mockReset().mockRejectedValue(new Error('offline'));
  });

  it('predice la jornada de LaLiga como en la app, y volver a pulsar el signo lo quita', async () => {
    renderDemo();
    expect(await screen.findByRole('heading', { name: 'Jornada 13 · LaLiga' })).toBeInTheDocument();
    expect(screen.getByText('0/5 predicciones')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Fórmula 1' })).not.toBeInTheDocument();
    // Fuera de una liga no hay amigos que ver.
    expect(screen.queryByRole('button', { name: /Ver predicciones de/ })).not.toBeInTheDocument();

    fireEvent.click(sign('Barcelona - Villarreal', '1'));
    expect(screen.getByText('1/5 predicciones')).toBeInTheDocument();
    expect(sign('Barcelona - Villarreal', '1')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(sign('Barcelona - Villarreal', '1'));
    expect(screen.getByText('0/5 predicciones')).toBeInTheDocument();
    expect(fetchMatches).toHaveBeenCalledWith(4);
  });

  it('enseña la jornada en curso de la API: la del primer partido sin jugar', async () => {
    vi.mocked(fetchMatches).mockResolvedValue([
      match(1, 'Sevilla', 'Betis', 'Jornada 13', true),
      match(2, 'Girona', 'Celta', 'Jornada 14'),
      match(3, 'Mallorca', 'Valencia', 'Jornada 14'),
      match(4, 'Elche', 'Oviedo', 'Jornada 15'),
    ]);
    renderDemo();
    expect(await screen.findByRole('heading', { name: 'Jornada 14 · LaLiga' })).toBeInTheDocument();
    expect(screen.getByText('0/2 predicciones')).toBeInTheDocument();
    expect(screen.queryByText(/Elche/)).not.toBeInTheDocument();
  });

  it('predice la cartelera estelar de la próxima UFC', async () => {
    renderDemo();
    fireEvent.click(screen.getByRole('tab', { name: 'UFC' }));
    expect(
      await screen.findByRole('heading', { name: 'UFC Fight Night: Adesanya vs Magomedov' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cartelera estelar · 0/6 predicciones')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gana Israel Adesanya (24-6-0)' }));
    expect(screen.getByRole('button', { name: 'Gana Israel Adesanya (24-6-0)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Cartelera estelar · 1/6 predicciones')).toBeInTheDocument();
  });
});
