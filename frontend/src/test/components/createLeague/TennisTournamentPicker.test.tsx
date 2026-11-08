import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import TennisTournamentPicker from '../../../components/createLeague/TennisTournamentPicker';
import {
  emptyDraft,
  normalizeDraft,
  type LeagueDraft,
} from '../../../components/createLeague/leagueDraft';
import type { Competition } from '../../../types/api';

const competition = (id: number, draw: 'MEN' | 'WOMEN'): Competition => ({
  id,
  name: 'Roland Garros',
  externalId: `tennis.${draw === 'MEN' ? 'atp' : 'wta'}.172`,
  formatType: 'TOURNAMENT',
  sport: 'TENNIS',
  finished: false,
  tennis: {
    tournamentId: 172,
    tournament: 'Roland Garros',
    level: 'GRAND_SLAM',
    draw,
    setsToWin: draw === 'MEN' ? 3 : 2,
    startDate: '2027-05-23T04:00:00Z',
    endDate: '2027-06-07T03:59:00Z',
  },
});

const ctx = { competitions: [competition(10, 'MEN'), competition(11, 'WOMEN')] };

function Harness() {
  const [draft, setDraft] = useState<LeagueDraft>({ ...emptyDraft(), sport: 'TENNIS' });
  return (
    <>
      <TennisTournamentPicker
        draft={draft}
        update={(patch) => setDraft((current) => normalizeDraft({ ...current, ...patch }, ctx))}
        errors={{}}
        ctx={ctx}
      />
      <output data-testid="scope">{`${draft.tennisScope ?? 'one'}:${draft.competitionId}`}</output>
    </>
  );
}

describe('TennisTournamentPicker', () => {
  it('elige un torneo o varios, y con varios no pide el torneo pero sí el cuadro', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: /un torneo/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /roland garros/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /solo los grand slams/i }));
    expect(screen.getByTestId('scope')).toHaveTextContent('GRAND_SLAMS:10');
    expect(screen.queryByRole('radio', { name: /roland garros/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /femenino/i }));
    expect(screen.getByTestId('scope')).toHaveTextContent('GRAND_SLAMS:11');

    fireEvent.click(screen.getByRole('radio', { name: /un torneo/i }));
    expect(screen.getByRole('radio', { name: /roland garros/i })).toBeInTheDocument();
  });
});
