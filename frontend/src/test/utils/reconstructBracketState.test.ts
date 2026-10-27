import { describe, it, expect } from 'vitest';
import { reconstructBracketState } from '../../hooks/useBracket';

describe('reconstructBracketState', () => {
  it('correctly parses final whether it is array of strings, object, or finalMatch', () => {
    // Array of strings
    const state1 = reconstructBracketState({
      final: ['España', 'Brasil'],
      champion: 'España',
    });
    expect(state1.final.home.name).toBe('España');
    expect(state1.final.away.name).toBe('Brasil');
    expect(state1.champion.name).toBe('España');

    // Object with home/away strings
    const state2 = reconstructBracketState({
      final: { home: 'Paraguay', away: 'Suiza' },
      champion: 'Paraguay',
    });
    expect(state2.final.home.name).toBe('Paraguay');
    expect(state2.final.away.name).toBe('Suiza');

    // Object with home/away { name } objects
    const state3 = reconstructBracketState({
      final: { home: { name: 'Francia' }, away: { name: 'Alemania' } },
      champion: { name: 'Francia' },
    });
    expect(state3.final.home.name).toBe('Francia');
    expect(state3.final.away.name).toBe('Alemania');
    expect(state3.champion.name).toBe('Francia');

    // finalMatch key
    const state4 = reconstructBracketState({
      finalMatch: ['Argentina', 'Portugal'],
      champion: 'Argentina',
    });
    expect(state4.final.home.name).toBe('Argentina');
    expect(state4.final.away.name).toBe('Portugal');
  });

  it('correctly populates r32 from r1 fallback or groups fallback', () => {
    // 16 matches in r1
    const dummyR1 = Array.from({ length: 16 }, (_, i) => [`Home${i}`, `Away${i}`]);
    const stateFromR1 = reconstructBracketState({
      r1: dummyR1,
    });
    expect(stateFromR1.r32.left).toHaveLength(8);
    expect(stateFromR1.r32.right).toHaveLength(8);
    expect(stateFromR1.r32.left[0].home.name).toBe('Home0');
    expect(stateFromR1.r32.right[0].home.name).toBe('Home8');

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
    expect(stateFromGroups.r32.left).toHaveLength(8);
    expect(stateFromGroups.r32.right).toHaveLength(8);
    expect(stateFromGroups.r32.left[0].home.name).toBe('Alemania'); // 1E
    expect(stateFromGroups.r32.left[2].home.name).toBe('Países Bajos'); // 1F
    expect(stateFromGroups.r32.left[2].away.name).toBe('Marruecos'); // 2C
  });
});
