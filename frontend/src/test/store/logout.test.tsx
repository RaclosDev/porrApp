import { act, render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '../../context/AppContext';
import { queryClient } from '../../services/queryClient';
import { defaultBracketState, useAppStore } from '../../store/useAppStore';
import { GLOBAL_LEAGUE_ID } from '../../utils/constants';

const signIn = () => {
  localStorage.setItem('token', 'jwt');
  localStorage.setItem('my_prediction_name', 'Ana');
  localStorage.setItem('my_user_id', '7');
  localStorage.setItem('my_avatar_url', 'https://x/a.png');
  localStorage.setItem('activeGroupId', '10');
  localStorage.setItem('draft_bracket_u7_g10', '{}');
  localStorage.setItem('draft_matchday_u7_g10', '{}');
  localStorage.setItem('draft_groups_10', '{}');
  localStorage.setItem('pwa_banner_dismissed', 'true');
  queryClient.setQueryData(['myGroups', true], [{ id: 10 }]);
  useAppStore.setState({
    isAuthenticated: true,
    userName: 'Ana',
    userId: '7',
    userAvatarUrl: 'https://x/a.png',
    activeGroupId: '10',
    activeCompetitionId: 2,
    bracketState: { ...defaultBracketState, champion: { name: 'España' } },
    topScorer: 'Mbappé',
    viewerPredictionId: 3,
  });
};

const expectSignedOut = () => {
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('my_prediction_name')).toBeNull();
  expect(localStorage.getItem('my_user_id')).toBeNull();
  expect(localStorage.getItem('my_avatar_url')).toBeNull();
  expect(localStorage.getItem('activeGroupId')).toBeNull();
  expect(Object.keys(localStorage).filter((k) => k.startsWith('draft_'))).toEqual([]);
  // Las preferencias del dispositivo no son de la sesión.
  expect(localStorage.getItem('pwa_banner_dismissed')).toBe('true');
  expect(queryClient.getQueryData(['myGroups', true])).toBeUndefined();
  expect(useAppStore.getState()).toMatchObject({
    isAuthenticated: false,
    userName: '',
    userId: '',
    userAvatarUrl: '',
    activeGroupId: '',
    activeCompetitionId: null,
    bracketState: defaultBracketState,
    topScorer: '',
    viewerPredictionId: null,
  });
};

describe('logout()', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
  });

  it('limpia store, localStorage (incluidos borradores y liga activa) y la caché', () => {
    signIn();
    useAppStore.getState().logout();
    expectSignedOut();
  });

  it('se ejecuta con el evento auth-expired', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <div />
        </AppProvider>
      </QueryClientProvider>,
    );
    signIn();
    act(() => {
      window.dispatchEvent(new Event('auth-expired'));
    });
    expectSignedOut();
  });

  it('salir de la demo cierra la sesión y deja la liga global', () => {
    signIn();
    useAppStore.setState({ isDemoMode: true });
    useAppStore.getState().exitDemoMode();
    expect(localStorage.getItem('token')).toBeNull();
    expect(useAppStore.getState()).toMatchObject({
      isDemoMode: false,
      isAuthenticated: false,
      activeGroupId: GLOBAL_LEAGUE_ID,
    });
  });
});
