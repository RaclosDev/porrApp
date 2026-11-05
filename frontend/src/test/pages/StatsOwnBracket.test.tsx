import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Stats from '../../pages/Stats';
import Search from '../../pages/Search';
import { useAppContext } from '../../context/AppContext';
import { appContext } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));

// Una liga de Worlds de LoL no puede compararse con el cuadro real del Mundial.
const lolLeague = () =>
  appContext({
    activeGroupId: '7',
    activeGroupPoolFormat: 'FULL_BRACKET',
    activeCompetitionFormatType: 'TOURNAMENT',
    activeCompetitionExternalId: 'lol.worlds',
    activeGroupOwnBracket: true,
  });

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </MemoryRouter>,
  );

it.each(['/stats', '/search'])('sends own-bracket leagues away from %s', (path) => {
  vi.mocked(useAppContext).mockReturnValue(lolLeague());
  renderAt(path);
  expect(screen.getByText('Portada')).toBeInTheDocument();
});
