import { describe, it, expect } from 'vitest';
import {
  extractGroupsFromR32,
  hasValidGroupSelections,
  normalizeGroupsDraft,
} from '../../utils/bracketDraft';

describe('Group stage extraction and validation', () => {
  it('correctly identifies empty vs valid group selections', () => {
    expect(hasValidGroupSelections(null)).toBe(false);
    expect(hasValidGroupSelections({})).toBe(false);
    expect(
      hasValidGroupSelections({
        A: { first: '', second: '', third: '' },
        B: { first: '', second: '', third: '' },
      }),
    ).toBe(false);
    expect(
      hasValidGroupSelections({
        A: ['', '', ''],
        B: ['', '', ''],
      }),
    ).toBe(false);
    expect(
      hasValidGroupSelections({
        A: { first: '1º Grupo A', second: '2º Grupo A', third: '???' },
      }),
    ).toBe(false);

    expect(
      hasValidGroupSelections({
        A: { first: 'España', second: '', third: '' },
      }),
    ).toBe(true);

    expect(
      hasValidGroupSelections({
        A: ['España', 'Alemania', 'Japón'],
      }),
    ).toBe(true);
  });

  it('normalizes groups draft from array and object', () => {
    const rawArray = {
      A: ['España', 'Alemania', 'Japón'],
    };
    const norm1 = normalizeGroupsDraft(rawArray);
    expect(norm1.A).toEqual({
      first: 'España',
      second: 'Alemania',
      third: 'Japón',
    });

    const rawObj = {
      B: { first: 'Brasil', second: 'Francia' },
    };
    const norm2 = normalizeGroupsDraft(rawObj);
    expect(norm2.B).toEqual({
      first: 'Brasil',
      second: 'Francia',
      third: '',
    });
  });

  it('extracts groups and thirds from bracketState.r32 object with left and right', () => {
    const bracketStateR32 = {
      left: [
        { home: { name: 'Alemania' }, away: { name: 'Escocia' } }, // 1º E vs 3º C
        { home: { name: 'Francia' }, away: { name: 'Bélgica' } }, // 1º I vs 3º G
        { home: { name: 'Países Bajos' }, away: { name: 'Marruecos' } }, // 1º F vs 2º C
        { home: { name: 'Brasil' }, away: { name: 'Japón' } }, // 1º C vs 2º F
        { home: { name: 'Sudáfrica' }, away: { name: 'Bosnia y Her.' } }, // 2º A vs 2º B
        { home: { name: 'Curaçao' }, away: { name: 'Senegal' } }, // 2º E vs 2º I
        { home: { name: 'México' }, away: { name: 'Suiza' } }, // 1º A vs 3º B
        { home: { name: 'Inglaterra' }, away: { name: 'Corea del Sur' } }, // 1º L vs 3º A
      ],
      right: [
        { home: { name: 'RD Congo' }, away: { name: 'Croacia' } }, // 2º K vs 2º L
        { home: { name: 'España' }, away: { name: 'Argelia' } }, // 1º H vs 2º J
        { home: { name: 'EEUU' }, away: { name: 'Ecuador' } }, // 1º D vs 3º E
        { home: { name: 'Nueva Zelanda' }, away: { name: 'Australia' } }, // 1º G vs 3º D
        { home: { name: 'Argentina' }, away: { name: 'Cabo Verde' } }, // 1º J vs 2º H
        { home: { name: 'Paraguay' }, away: { name: 'Egipto' } }, // 2º D vs 2º G
        { home: { name: 'Canadá' }, away: { name: 'Suecia' } }, // 1º B vs 3º F
        { home: { name: 'Portugal' }, away: { name: 'Uruguay' } }, // 1º K vs 3º H
      ],
    };

    const { groups, thirds } = extractGroupsFromR32(bracketStateR32);

    expect(groups.A.first).toBe('México');
    expect(groups.A.second).toBe('Sudáfrica');
    expect(groups.A.third).toBe('Corea del Sur');

    expect(groups.B.first).toBe('Canadá');
    expect(groups.B.second).toBe('Bosnia y Her.');
    expect(groups.B.third).toBe('Suiza');

    expect(groups.C.first).toBe('Brasil');
    expect(groups.C.second).toBe('Marruecos');
    expect(groups.C.third).toBe('Escocia');

    expect(groups.H.first).toBe('España');
    expect(groups.H.second).toBe('Cabo Verde');
    expect(groups.H.third).toBe('Uruguay');

    expect(thirds).toContain('Escocia');
    expect(thirds).toContain('Suiza');
    expect(thirds).toContain('Corea del Sur');
    expect(thirds).toContain('Ecuador');
    expect(thirds).toContain('Australia');
    expect(thirds).toContain('Suecia');
    expect(thirds).toContain('Uruguay');
  });

  it('extracts groups from array of 16 pairs', () => {
    const pairs = [
      ['Alemania', 'Escocia'],
      ['Francia', 'Bélgica'],
      ['Países Bajos', 'Marruecos'],
      ['Brasil', 'Japón'],
      ['Sudáfrica', 'Bosnia y Her.'],
      ['Curaçao', 'Senegal'],
      ['México', 'Suiza'],
      ['Inglaterra', 'Corea del Sur'],
      ['RD Congo', 'Croacia'],
      ['España', 'Argelia'],
      ['EEUU', 'Ecuador'],
      ['Nueva Zelanda', 'Australia'],
      ['Argentina', 'Cabo Verde'],
      ['Paraguay', 'Egipto'],
      ['Canadá', 'Suecia'],
      ['Portugal', 'Uruguay'],
    ];

    const { groups, thirds } = extractGroupsFromR32(pairs);
    expect(groups.H.first).toBe('España');
    expect(groups.A.first).toBe('México');
    expect(thirds.length).toBe(8);
  });
});
