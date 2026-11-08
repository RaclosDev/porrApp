import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import FormatStep from '../../../components/createLeague/FormatStep';
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
  const props = {
    draft,
    update: (patch: Partial<LeagueDraft>) =>
      setDraft((current) => normalizeDraft({ ...current, ...patch }, ctx)),
    errors: {},
    ctx,
  };
  return (
    <>
      <section aria-label="Competición">
        <TennisTournamentPicker {...props} />
      </section>
      <section aria-label="Modo de juego">
        <FormatStep {...props} />
      </section>
      <output data-testid="scope">
        {`${draft.tennisScope ?? 'one'}:${draft.tennisDraw}:${draft.competitionId}`}
      </output>
    </>
  );
}

describe('Tenis en /crear-liga', () => {
  it('con toda la temporada, los torneos y el circuito se eligen en el modo de juego, como en UFC', () => {
    render(<Harness />);
    const competitionStep = screen.getByRole('region', { name: 'Competición' });
    const formatStep = screen.getByRole('region', { name: 'Modo de juego' });
    expect(screen.queryByRole('radio', { name: /solo los grand slams/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /toda la temporada/i }));
    expect(screen.getByTestId('scope')).toHaveTextContent('ALL:MEN:10');
    expect(screen.getByRole('radio', { name: /roland garros/i })).not.toBeChecked();
    expect(competitionStep).not.toHaveTextContent('Femenino');

    fireEvent.click(screen.getByRole('radio', { name: /solo los grand slams/i }));
    expect(screen.getByTestId('scope')).toHaveTextContent('GRAND_SLAMS:MEN:10');
    expect(formatStep).toHaveTextContent('Circuito');
    fireEvent.click(screen.getByRole('radio', { name: /solo wta/i }));
    expect(screen.getByTestId('scope')).toHaveTextContent('GRAND_SLAMS:WOMEN:11');
    fireEvent.click(screen.getByRole('radio', { name: /atp y wta/i }));
    expect(screen.getByTestId('scope')).toHaveTextContent('GRAND_SLAMS:BOTH:10');

    fireEvent.click(screen.getByRole('radio', { name: /roland garros/i }));
    expect(screen.getByTestId('scope')).toHaveTextContent(/^one:/);
    expect(screen.queryByRole('radio', { name: /solo los grand slams/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /femenino/i })).toBeInTheDocument();
  });

  it('un torneo solo femenino, como las WTA Finals, se elige con su cuadro femenino', () => {
    const wtaFinals: Competition = {
      id: 20,
      name: 'WTA Finals',
      externalId: 'tennis.wta.382',
      formatType: 'TOURNAMENT',
      sport: 'TENNIS',
      finished: false,
      tennis: {
        tournamentId: 382,
        tournament: 'WTA Finals',
        level: 'FINALS',
        draw: 'WOMEN',
        setsToWin: 2,
        startDate: '2026-11-08T05:00:00Z',
        endDate: '2026-11-16T04:59:00Z',
      },
    };
    const finalsCtx = { competitions: [wtaFinals] };
    const update = (patch: Partial<LeagueDraft>) =>
      normalizeDraft({ ...emptyDraft(), sport: 'TENNIS', ...patch }, finalsCtx);
    render(
      <TennisTournamentPicker
        draft={{ ...emptyDraft(), sport: 'TENNIS' }}
        update={update}
        errors={{}}
        ctx={finalsCtx}
      />,
    );

    expect(screen.getByRole('radio', { name: /wta finals/i })).toHaveAccessibleDescription(
      /Cuadro femenino/,
    );
    expect(update({ competitionId: 20 }).tennisDraw).toBe('WOMEN');
  });
});
