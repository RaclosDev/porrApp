import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BestThirdsPanel from '../../components/Home/BestThirdsPanel';
import type { GroupStandings } from '../../types/api';
import { standing } from '../fixtures';

/** Terceros de la Eurocopa 2024, con el puesto entre terceros que da el backend. */
const EURO_2024: GroupStandings = {
  A: { Hungría: standing({ pos: 3, pts: 3, diff: -3, gls: 2, mp: 3, third: 5 }) },
  B: { Croacia: standing({ pos: 3, pts: 2, diff: -3, gls: 3, mp: 3, third: 6 }) },
  C: { Eslovenia: standing({ pos: 3, pts: 3, diff: 0, gls: 2, mp: 3, third: 4 }) },
  D: { 'Países Bajos': standing({ pos: 3, pts: 4, diff: 0, gls: 4, mp: 3, fp: -2, third: 1 }) },
  E: { Eslovaquia: standing({ pos: 3, pts: 4, diff: 0, gls: 3, mp: 3, third: 3 }) },
  F: { Georgia: standing({ pos: 3, pts: 4, diff: 0, gls: 4, mp: 3, fp: -6, third: 2 }) },
};

const rowOf = (team: string) => screen.getByText(team).closest('.grid') as HTMLElement;

describe('BestThirdsPanel', () => {
  it('lists the thirds in the order of the tournament rules and cuts where its format says', () => {
    render(<BestThirdsPanel officialPoints={EURO_2024} qualifying={4} />);

    const names = ['Países Bajos', 'Georgia', 'Eslovaquia', 'Eslovenia', 'Hungría', 'Croacia'];
    const rows = names.map(rowOf);
    rows.forEach((row, idx) => expect(row.firstElementChild?.textContent).toBe(String(idx + 1)));

    // Pasan cuatro: el corte va bajo Eslovenia y los dos últimos quedan atenuados.
    expect(rows.map((row) => row.style.opacity)).toEqual(['1', '1', '1', '1', '0.5', '0.5']);
    expect(rows.map((row) => row.className.includes('dashed'))).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('keeps the eight of the World Cup when the format is not given', () => {
    render(<BestThirdsPanel officialPoints={EURO_2024} />);

    expect(rowOf('Croacia').style.opacity).toBe('1');
  });
});
