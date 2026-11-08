import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import CardSegmentsField from '../../../components/createLeague/CardSegmentsField';
import {
  emptyDraft,
  type LeagueDraft,
  type StepErrors,
} from '../../../components/createLeague/leagueDraft';

function Harness({ errors = {} }: { errors?: StepErrors }) {
  const [draft, setDraft] = useState<LeagueDraft>(emptyDraft());
  return (
    <>
      <CardSegmentsField
        draft={draft}
        update={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        errors={errors}
        ctx={{ competitions: [] }}
      />
      <output data-testid="segments">{draft.cardSegments.join(',')}</output>
    </>
  );
}

const box = (name: RegExp) => screen.getByRole<HTMLInputElement>('checkbox', { name });

describe('CardSegmentsField', () => {
  it('empieza con toda la velada y marca o desmarca las tres partes a la vez', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Peleas de cada velada' })).toBeInTheDocument();
    const all = box(/toda la velada/i);
    expect(all).toBeChecked();
    expect(box(/cartelera estelar/i)).toBeChecked();

    fireEvent.click(all);
    expect(screen.getByTestId('segments')).toHaveTextContent(/^$/);
    expect(box(/preliminares tempranos/i)).not.toBeChecked();

    fireEvent.click(all);
    expect(screen.getByTestId('segments')).toHaveTextContent('EARLY_PRELIMS,PRELIMS,MAIN');
  });

  it('con solo algunas partes, «Toda la velada» queda a medias', () => {
    render(<Harness />);
    fireEvent.click(box(/^preliminares prelims$/i));
    fireEvent.click(box(/preliminares tempranos/i));
    expect(screen.getByTestId('segments')).toHaveTextContent(/^MAIN$/);
    const all = box(/toda la velada/i);
    expect(all).not.toBeChecked();
    expect(all.indeterminate).toBe(true);

    fireEvent.click(box(/preliminares tempranos/i));
    expect(screen.getByTestId('segments')).toHaveTextContent('EARLY_PRELIMS,MAIN');
  });

  it('enlaza el error cuando no hay ninguna parte marcada', () => {
    render(<Harness errors={{ cardSegments: 'Marca al menos una parte de la cartelera.' }} />);
    expect(
      screen.getByRole('group', { name: 'Peleas de cada velada' }),
    ).toHaveAccessibleDescription('Marca al menos una parte de la cartelera.');
  });
});
