import { describe, it, expect } from 'vitest';
import { reconstructBracketState } from '../../utils/bracketDraft';

describe('reconstructBracketState', () => {
  it('builds the final and the champion from the stored name lists', () => {
    const state1 = reconstructBracketState({
      final: ['España', 'Brasil'],
      champion: 'España',
    });
    expect(state1?.final?.home?.name).toBe('España');
    expect(state1?.final?.away?.name).toBe('Brasil');
    expect(state1?.champion?.name).toBe('España');
  });

  it('correctly populates r32 from r1 fallback or groups fallback', () => {
    // 16 matches in r1
    const dummyR1 = Array.from({ length: 16 }, (_, i) => [`Home${i}`, `Away${i}`]);
    const stateFromR1 = reconstructBracketState({
      r1: dummyR1,
    });
    expect(stateFromR1?.r32.left).toHaveLength(8);
    expect(stateFromR1?.r32.right).toHaveLength(8);
    expect(stateFromR1?.r32.left[0].home?.name).toBe('Home0');
    expect(stateFromR1?.r32.right[0].home?.name).toBe('Home8');

    // From groups fallback
    const mockGroups = {
      A: { first: 'México', second: 'Sudáfrica', third: 'Corea del Sur' },
      B: { first: 'Canadá', second: 'Bosnia y Her.', third: 'Catar' },
      C: { first: 'Brasil', second: 'Marruecos', third: 'Haití' },
      D: { first: 'EEUU', second: 'Paraguay', third: 'Australia' },
      E: { first: 'Alemania', second: 'Curaçao', third: 'Costa de Marfil' },
      F: { first: 'Países Bajos', second: 'Japón', third: 'Suecia' },
      G: { first: 'Bélgica', second: 'Egipto', third: 'Irán' },
      H: { first: 'España', second: 'Cabo Verde', third: 'Arabia Saudí' },
      I: { first: 'Francia', second: 'Senegal', third: 'Irak' },
      J: { first: 'Argentina', second: 'Argelia', third: 'Austria' },
      K: { first: 'Portugal', second: 'RD Congo', third: 'Uzbekistán' },
      L: { first: 'Inglaterra', second: 'Croacia', third: 'Ghana' },
    };
    const stateFromGroups = reconstructBracketState({
      groups: mockGroups,
      thirds: [
        'Corea del Sur',
        'Catar',
        'Haití',
        'Australia',
        'Costa de Marfil',
        'Suecia',
        'Irán',
        'Arabia Saudí',
      ],
    });
    expect(stateFromGroups?.r32.left).toHaveLength(8);
    expect(stateFromGroups?.r32.right).toHaveLength(8);
    expect(stateFromGroups?.r32.left[0].home?.name).toBe('Alemania'); // 1E
    expect(stateFromGroups?.r32.left[2].home?.name).toBe('Países Bajos'); // 1F
    expect(stateFromGroups?.r32.left[2].away?.name).toBe('Marruecos'); // 2C
  });
});
