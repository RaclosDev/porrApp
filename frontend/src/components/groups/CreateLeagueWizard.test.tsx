import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateLeagueWizard from './CreateLeagueWizard';
import type { Competition } from '../../types/api';

const competitions: Competition[] = [
  { id: 1, name: 'FIFA World Cup 2026', externalId: 'fifa.world', formatType: 'TOURNAMENT' },
  { id: 9, name: 'Worlds de League of Legends', externalId: 'lol.worlds', formatType: 'LEAGUE' },
];

function renderWizard(selectedCompetition: string, setSelectedPoolFormat = vi.fn()) {
  render(
    <CreateLeagueWizard
      competitions={competitions}
      newGroupName=""
      setNewGroupName={vi.fn()}
      customCompetitionName=""
      setCustomCompetitionName={vi.fn()}
      selectedCompetition={selectedCompetition}
      setSelectedCompetition={vi.fn()}
      selectedPoolFormat="MATCH_DAY"
      setSelectedPoolFormat={setSelectedPoolFormat}
      includePichichi={false}
      setIncludePichichi={vi.fn()}
      isCreating={false}
      handleCreate={vi.fn()}
      setShowCreateModal={vi.fn()}
    />,
  );
  return setSelectedPoolFormat;
}

const formatOptions = () =>
  Array.from((screen.getByLabelText('Formato') as HTMLSelectElement).options).map((o) => o.value);

describe('CreateLeagueWizard', () => {
  it('offers the bracket formats only for the World Cup', () => {
    renderWizard('1');
    expect(formatOptions()).toEqual(['MATCH_DAY', 'FULL_BRACKET', 'KNOCKOUTS_ONLY']);
  });

  it('plays other official competitions by matchday', () => {
    renderWizard('9');
    expect(formatOptions()).toEqual(['MATCH_DAY']);
  });

  it('switches to matchday when choosing a competition without bracket', () => {
    const setFormat = renderWizard('1');
    fireEvent.change(screen.getByLabelText('Competición'), { target: { value: '9' } });
    expect(setFormat).toHaveBeenCalledWith('MATCH_DAY');
  });
});
