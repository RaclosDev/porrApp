import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import InsightsHeader from '../../components/insights/InsightsHeader';
import { useAppContext } from '../../context/AppContext';
import type { LeagueKind } from '../../context/leagueKind';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../components/layout/prefetchRoute', () => ({ prefetchRoute: vi.fn() }));

const header = (leagueKind: LeagueKind) => {
  vi.mocked(useAppContext).mockReturnValue({ leagueKind } as ReturnType<typeof useAppContext>);
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <InsightsHeader leagueName="Mi liga" summary="Por jugador" />
    </MemoryRouter>,
  );
};

const tabs = () => screen.getAllByRole('link').map((link) => link.textContent);

it('en el tenis cambia entre las estadísticas por partido y el buscador', () => {
  header('tennisDraw');

  expect(screen.getByText('Mi liga')).toBeInTheDocument();
  expect(tabs()).toEqual(['Por partido', 'Buscador']);
  expect(screen.getByRole('link', { name: 'Por partido' })).toHaveAttribute('href', '/stats');
  expect(screen.getByRole('link', { name: 'Buscador' })).toHaveAttribute('aria-current', 'page');
});

it('en las ligas de cuadro y en la Fórmula 1 la pestaña es Más elegidos', () => {
  header('knockoutDraw');

  expect(tabs()).toEqual(['Más elegidos', 'Buscador']);
});

it('sin buscador no hay pestañas', () => {
  header('matchday');

  expect(screen.queryByRole('navigation')).toBeNull();
});
