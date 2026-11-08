import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CompetitionStep from '../../components/createLeague/CompetitionStep';
import { emptyDraft, sportChoices } from '../../components/createLeague/leagueDraft';
import type { Competition } from '../../types/api';

const competitions: Competition[] = [
  { id: 1, name: 'LaLiga', externalId: 'esp.1', formatType: 'LEAGUE', sport: 'FOOTBALL' },
  { id: 46, name: 'Fórmula 1', externalId: 'f1', formatType: 'RACE', sport: 'FORMULA_1' },
];
const ctx = { competitions };

describe('paso de la competición del asistente', () => {
  it('la Fórmula 1 se puede elegir: antes no salía en ningún grupo y no había forma de crear la liga', () => {
    expect(sportChoices(ctx)).toContain('FORMULA_1');
    const update = vi.fn();
    render(
      <CompetitionStep
        draft={{ ...emptyDraft(), sport: 'FORMULA_1' }}
        update={update}
        errors={{}}
        ctx={ctx}
      />,
    );

    // Un solo grupo: su título sobra.
    expect(screen.queryByText('Gran Premio a Gran Premio')).not.toBeInTheDocument();
    expect(screen.queryByText('LaLiga')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Fórmula 1/ }));
    expect(update).toHaveBeenCalledWith({ custom: false, competitionId: 46 });
  });
});
