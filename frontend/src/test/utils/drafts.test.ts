import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllDrafts,
  draftKey,
  readDraft,
  readJsonDraft,
  removeDraft,
  writeDraft,
} from '../../utils/drafts';
import { defaultBracketState, useAppStore } from '../../store/useAppStore';

describe('borradores por usuario', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('separa los borradores de cada usuario en la misma liga', () => {
    writeDraft('matchday', '10', '7', { 1: { homeScore: '2' } });
    expect(readJsonDraft('matchday', '10', '7')).toEqual({ 1: { homeScore: '2' } });
    expect(readDraft('matchday', '10', '8')).toBeNull();
    expect(draftKey('matchday', '10', '7')).not.toBe(draftKey('matchday', '10', '8'));
  });

  it('migra un borrador antiguo sin usuario solo al primero que lo lee', () => {
    localStorage.setItem('draft_groups_10', '{"A":{"first":"España"}}');
    expect(readDraft('groups', '10', '7')).toBe('{"A":{"first":"España"}}');
    expect(localStorage.getItem('draft_groups_10')).toBeNull();
    expect(localStorage.getItem(draftKey('groups', '10', '7'))).not.toBeNull();
    expect(readDraft('groups', '10', '8')).toBeNull();
  });

  it('devuelve undefined con JSON corrupto', () => {
    localStorage.setItem(draftKey('bracket', '10', '7'), '{roto');
    expect(readJsonDraft('bracket', '10', '7')).toBeUndefined();
  });

  it('removeDraft borra también la clave antigua', () => {
    localStorage.setItem('draft_bracket_10', '{}');
    writeDraft('bracket', '10', '7', {});
    removeDraft('bracket', '10', '7');
    expect(localStorage.getItem('draft_bracket_10')).toBeNull();
    expect(readDraft('bracket', '10', '7')).toBeNull();
  });

  it('clearAllDrafts borra solo las claves draft_*', () => {
    writeDraft('bracket', '10', '7', {});
    localStorage.setItem('draft_matchday_3', '{}');
    localStorage.setItem('token', 'x');
    clearAllDrafts();
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('token')).toBe('x');
  });

  it('el store carga el cuadro del nuevo usuario al cambiar de usuario', () => {
    const mine = { ...defaultBracketState, champion: { name: 'España' } };
    writeDraft('bracket', '10', '7', mine);
    useAppStore.setState({ activeGroupId: '10', userId: '', bracketState: defaultBracketState });
    useAppStore.getState().setUserId('7');
    expect(useAppStore.getState().bracketState.champion?.name).toBe('España');
    useAppStore.getState().setUserId('8');
    expect(useAppStore.getState().bracketState).toBe(defaultBracketState);
  });
});
