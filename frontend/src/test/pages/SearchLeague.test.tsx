import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Search from '../../pages/Search';
import { useAppContext } from '../../context/AppContext';
import { appContext, group } from '../context/fixtures';
vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
it('does not render the active league results for a different shared league', () => {
  const changeGroup = vi.fn();
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      activeGroupId: '2',
      activeGroupPoolFormat: 'MATCH_DAY',
      userGroups: [group({ id: 1, name: 'Liga compartida' })],
      changeGroup,
    }),
  );
  render(
    <MemoryRouter initialEntries={['/search?group=1&team=España']}>
      <Search />
    </MemoryRouter>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('otra liga');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Liga compartida' }));
  expect(changeGroup).toHaveBeenCalledWith(1);
});
it('does not offer switching into an unknown league', () => {
  vi.mocked(useAppContext).mockReturnValue(appContext({ activeGroupId: '2' }));
  render(
    <MemoryRouter initialEntries={['/search?group=9']}>
      <Search />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link')).toHaveAttribute('href', '/mis-ligas');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
