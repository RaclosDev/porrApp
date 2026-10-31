import { describe, expect, it } from 'vitest';
import { defaultBracketState, type BracketState } from '../../store/useAppStore';
import { advanceBracketWinner, replaceR32Team } from '../../utils/bracketTransitions';

const semiState = (): BracketState => ({
  ...structuredClone(defaultBracketState),
  sf: {
    left: [{ id: 'L2', home: { name: 'España' }, away: { name: 'Francia' } }],
    right: [{ id: 'R2', home: { name: 'Brasil' }, away: { name: 'Japón' } }],
  },
  final: { id: 'F', home: { name: 'España' }, away: { name: 'Brasil' } },
  thirdPlaceMatch: { id: 'T', home: { name: 'Francia' }, away: { name: 'Japón' } },
  champion: { name: 'Brasil' },
  thirdPlaceWinner: { name: 'Japón' },
});

describe('transiciones del cuadro', () => {
  it('limpia campeón/tercero si se intercambian sus puestos en la semifinal derecha', () => {
    const original = semiState();
    const next = advanceBracketWinner(original, { name: 'Japón' }, 'right', 3, 0);
    expect(next.final?.away?.name).toBe('Japón');
    expect(next.thirdPlaceMatch?.away?.name).toBe('Brasil');
    expect(next.champion).toBeNull();
    expect(next.thirdPlaceWinner).toBeNull();
    expect(next.final?.home).toEqual(original.final?.home);
    expect(original.champion?.name).toBe('Brasil');
  });

  it('cambia al perdedor de semifinal aunque su ganador se mantenga', () => {
    const state = semiState();
    state.qf.left[1] = { id: 'Q', home: { name: 'Francia' }, away: { name: 'Italia' } };
    state.thirdPlaceWinner = { name: 'Francia' };
    const next = advanceBracketWinner(state, { name: 'Italia' }, 'left', 2, 1);
    expect(next.final).toEqual(state.final);
    expect(next.champion).toEqual(state.champion);
    expect(next.thirdPlaceMatch?.home?.name).toBe('Italia');
    expect(next.thirdPlaceWinner).toBeNull();
  });

  it('permite avanzar en un borrador parcial sin inventar rival ni ganador posterior', () => {
    const state = structuredClone(defaultBracketState);
    state.r32.right[7].home = { name: 'Japón' };
    state.r32.right[7].away = null;
    const next = advanceBracketWinner(state, { name: 'Japón' }, 'right', 0, 7);
    expect(next.r16.right[3].away?.name).toBe('Japón');
    expect(next.r16.right[3].home).toBeNull();
    expect(next.final).toBeNull();
    expect(next.thirdPlaceMatch).toBeNull();
    expect(next.champion).toBeNull();
  });

  it('solo selecciona campeón/tercero entre los participantes actuales', () => {
    const state = semiState();
    expect(advanceBracketWinner(state, { name: 'Italia' }, 'center', 4, 0)).toBe(state);
    const champion = advanceBracketWinner(state, { name: 'España' }, 'center', 4, 0);
    expect(champion.champion?.name).toBe('España');
    const third = advanceBracketWinner(champion, { name: 'Francia' }, 'center', 5, 0);
    expect(third.thirdPlaceWinner?.name).toBe('Francia');
    expect(third.champion?.name).toBe('España');
  });

  it('reemplazar un hueco por el mismo equipo no altera el borrador', () => {
    const state = structuredClone(defaultBracketState);
    state.r32.left[0].home = { name: 'España' };
    expect(replaceR32Team(state, 'España', 'left', 0, true)).toBe(state);
  });
});
