import { describe, it, expect, beforeEach } from 'vitest';
import { defaultBracketState, getInitialBracketState } from '../../store/useAppStore';

describe('bracket persistence & hydration on reload (F5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaultBracketState if no draft exists in localStorage', () => {
    const state = getInitialBracketState('42');
    expect(state).toEqual(defaultBracketState);
    expect(state.r32.left[0].home.name).toContain('º');
  });

  it('returns saved bracket state with real countries from localStorage', () => {
    const customBracket = JSON.parse(JSON.stringify(defaultBracketState));
    customBracket.r32.left[0].home = { name: 'España', id: 'L1_home' };
    customBracket.r32.left[0].away = { name: 'Alemania', id: 'L1_away' };

    localStorage.setItem('draft_bracket_42', JSON.stringify(customBracket));

    const state = getInitialBracketState('42');
    expect(state.r32.left[0].home.name).toBe('España');
    expect(state.r32.left[0].away.name).toBe('Alemania');
    expect(state.r32.left[0].home.name).not.toContain('º');
  });

  it('handles invalid or corrupted JSON gracefully by returning defaultBracketState', () => {
    localStorage.setItem('draft_bracket_42', 'INVALID_JSON{{{');

    const state = getInitialBracketState('42');
    expect(state).toEqual(defaultBracketState);
  });
});
