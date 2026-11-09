import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateUserPreferences } from '../../services/api';
import { SESSION_HINT_KEY } from '../../services/sessionHint';
import {
  defaultBracketState,
  forgetGroupVisit,
  getDefaultBracketState,
  readGroupVisits,
  useAppStore,
  type BracketState,
} from '../../store/useAppStore';
import type { TournamentFormat } from '../../types/api';
import { orderR32 } from '../../utils/bracketTopology';

vi.mock(import('../../services/api'), async (original) => ({
  ...(await original()),
  updateUserPreferences: vi.fn(),
}));

const store = () => useAppStore.getState();

/** Cuadro con un campeón elegido, para distinguirlo del vacío. */
const bracketWith = (champion: string): BracketState => ({
  ...structuredClone(defaultBracketState),
  champion: { name: champion },
});

const storedDraft = (userId: string, groupId: string) =>
  JSON.parse(localStorage.getItem(`draft_bracket_u${userId}_g${groupId}`) ?? 'null');

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(updateUserPreferences).mockResolvedValue({ status: 'ok' } as never);
  useAppStore.setState({
    userId: '7',
    activeGroupId: '10',
    activeCompetitionId: 2,
    bracketState: bracketWith('España'),
    topScorer: 'Mbappé',
    viewerPredictionId: 3,
    profileSetupCompleted: null,
    isDemoMode: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('changeGroup()', () => {
  it('guarda el borrador del cuadro de la liga que se deja y carga el de la nueva', () => {
    localStorage.setItem('draft_bracket_u7_g11', JSON.stringify(bracketWith('Brasil')));

    store().changeGroup('11');

    expect(storedDraft('7', '10').champion).toEqual({ name: 'España' });
    expect(store().bracketState.champion).toEqual({ name: 'Brasil' });
    expect(store().activeGroupId).toBe('11');
  });

  it('abre con el cuadro vacío una liga sin borrador y olvida lo que se veía de la anterior', () => {
    localStorage.setItem('activeCompetitionId', '2');

    store().changeGroup(12);

    expect(store()).toMatchObject({
      activeGroupId: '12',
      activeCompetitionId: null,
      bracketState: defaultBracketState,
      topScorer: '',
      viewerPredictionId: null,
    });
    expect(localStorage.getItem('activeGroupId')).toBe('12');
    expect(localStorage.getItem('activeCompetitionId')).toBeNull();
  });

  it('no mezcla borradores de dos usuarios del mismo dispositivo', () => {
    localStorage.setItem('draft_bracket_u8_g11', JSON.stringify(bracketWith('Italia')));

    store().changeGroup('11');

    expect(store().bracketState).toBe(defaultBracketState);
  });

  it('apunta la visita y recuerda la liga en la cuenta, para abrirla en otro dispositivo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T18:00:00Z'));
    localStorage.setItem('group_last_visited', JSON.stringify({ 10: 5 }));

    store().changeGroup('11');

    expect(readGroupVisits()).toEqual({ 10: 5, 11: Date.parse('2026-06-11T18:00:00Z') });
    expect(updateUserPreferences).toHaveBeenCalledWith({ lastSelectedGroupId: 11 });
  });

  it('cambia de liga aunque no se pueda guardar la preferencia en el servidor', async () => {
    const failed = Promise.reject(new Error('sin red'));
    vi.mocked(updateUserPreferences).mockReturnValue(failed);

    store().changeGroup('11');
    await expect(failed).rejects.toThrow('sin red');

    expect(store().activeGroupId).toBe('11');
  });

  it('rehace el registro de visitas si el guardado está corrupto', () => {
    localStorage.setItem('group_last_visited', '{{{');

    store().changeGroup('11');

    expect(Object.keys(readGroupVisits())).toEqual(['11']);
  });

  it('no hace nada al elegir la liga que ya está abierta', () => {
    store().changeGroup(10);

    expect(store()).toMatchObject({ topScorer: 'Mbappé', viewerPredictionId: 3 });
    expect(storedDraft('7', '10')).toBeNull();
    expect(updateUserPreferences).not.toHaveBeenCalled();
  });

  it('al quedarse sin liga guarda el borrador y no deja ninguna elegida', () => {
    localStorage.setItem('activeGroupId', '10');

    store().changeGroup(null);

    expect(storedDraft('7', '10').champion).toEqual({ name: 'España' });
    expect(store()).toMatchObject({ activeGroupId: '', bracketState: defaultBracketState });
    expect(localStorage.getItem('activeGroupId')).toBeNull();
    expect(updateUserPreferences).not.toHaveBeenCalled();
  });

  it('desde ninguna liga no guarda un borrador sin liga', () => {
    useAppStore.setState({ activeGroupId: '' });

    store().changeGroup('11');

    expect(Object.keys(localStorage).filter((key) => key.startsWith('draft_'))).toEqual([]);
    expect(store().activeGroupId).toBe('11');
  });
});

describe('setUserId()', () => {
  it('carga el borrador del usuario que entra y vuelve a comprobar su perfil', () => {
    localStorage.setItem('draft_bracket_u8_g10', JSON.stringify(bracketWith('Italia')));
    useAppStore.setState({ profileSetupCompleted: true });

    store().setUserId('8');

    expect(store()).toMatchObject({ userId: '8', profileSetupCompleted: null });
    expect(store().bracketState.champion).toEqual({ name: 'Italia' });
    expect(localStorage.getItem('my_user_id')).toBe('8');
  });

  it('no toca el cuadro en pantalla si el usuario es el mismo', () => {
    const editing = store().bracketState;
    useAppStore.setState({ profileSetupCompleted: true });

    store().setUserId('7');

    expect(store().bracketState).toBe(editing);
    expect(store().profileSetupCompleted).toBe(true);
  });

  it('sin usuario olvida su identificador y vuelve al cuadro vacío', () => {
    localStorage.setItem('my_user_id', '7');

    store().setUserId('');

    expect(localStorage.getItem('my_user_id')).toBeNull();
    expect(store().bracketState).toBe(defaultBracketState);
  });
});

describe('datos de la sesión guardados en el dispositivo', () => {
  it('guarda nombre, foto, liga y competición, y los borra al vaciarlos', () => {
    store().setUserName('Ana');
    store().setUserAvatarUrl('https://x/a.png');
    store().setActiveGroupId('15');
    store().setActiveCompetitionId(4);
    expect(store()).toMatchObject({
      userName: 'Ana',
      userAvatarUrl: 'https://x/a.png',
      activeGroupId: '15',
      activeCompetitionId: 4,
    });
    expect(localStorage.getItem('my_prediction_name')).toBe('Ana');
    expect(localStorage.getItem('my_avatar_url')).toBe('https://x/a.png');
    expect(localStorage.getItem('activeGroupId')).toBe('15');
    expect(localStorage.getItem('activeCompetitionId')).toBe('4');

    store().setUserName('');
    store().setUserAvatarUrl(null);
    store().setActiveGroupId(null);
    store().setActiveCompetitionId(null);
    expect(store()).toMatchObject({
      userName: '',
      userAvatarUrl: '',
      activeGroupId: '',
      activeCompetitionId: null,
    });
    for (const key of [
      'my_prediction_name',
      'my_avatar_url',
      'activeGroupId',
      'activeCompetitionId',
    ]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('un perfil ya completado no vuelve a pendiente por una respuesta atrasada', () => {
    store().setProfileSetupCompleted(false);
    expect(store().profileSetupCompleted).toBe(false);

    store().setProfileSetupCompleted(true);
    store().setProfileSetupCompleted(false);

    expect(store().profileSetupCompleted).toBe(true);
  });
});

describe('modo demo', () => {
  it('entra en la liga indicada y deja de mirar la porra y la competición de antes', () => {
    localStorage.setItem('activeCompetitionId', '2');

    store().enterDemoMode('99');

    expect(store()).toMatchObject({
      isDemoMode: true,
      activeGroupId: '99',
      activeCompetitionId: null,
      viewerPredictionId: null,
    });
    expect(localStorage.getItem('isDemoMode')).toBe('true');
    expect(localStorage.getItem('activeGroupId')).toBe('99');
    expect(localStorage.getItem('activeCompetitionId')).toBeNull();
  });

  it('sin liga entra sin ninguna elegida, a la espera de la liga pública destacada', () => {
    localStorage.setItem('activeGroupId', '10');

    store().enterDemoMode();

    expect(store()).toMatchObject({ isDemoMode: true, activeGroupId: '' });
    expect(localStorage.getItem('activeGroupId')).toBeNull();
  });

  it('recuerda en el dispositivo si la demo está activa', () => {
    store().setIsDemoMode(true);
    expect(localStorage.getItem('isDemoMode')).toBe('true');

    store().setIsDemoMode(false);
    expect(localStorage.getItem('isDemoMode')).toBeNull();
    expect(store().isDemoMode).toBe(false);
  });
});

describe('registro de visitas de «Mis Ligas»', () => {
  it('está vacío si no hay nada guardado o lo guardado no es un mapa', () => {
    expect(readGroupVisits()).toEqual({});
    for (const raw of ['{{{', '[1,2]', '5', 'null']) {
      localStorage.setItem('group_last_visited', raw);
      expect(readGroupVisits()).toEqual({});
    }
  });

  it('olvida solo la liga que ya no es del usuario', () => {
    localStorage.setItem('group_last_visited', JSON.stringify({ 10: 5, 11: 9 }));

    forgetGroupVisit('10');

    expect(readGroupVisits()).toEqual({ 11: 9 });
  });

  it('no escribe nada al olvidar una liga que no estaba apuntada', () => {
    forgetGroupVisit('10');

    expect(localStorage.getItem('group_last_visited')).toBeNull();
  });
});

describe('getDefaultBracketState()', () => {
  it('un cuadro del Mundial anterior a la versión 2 conserva el orden antiguo de sus cruces', () => {
    const legacy = getDefaultBracketState();

    expect(legacy).toBe(getDefaultBracketState(1));
    expect(legacy.topologyVersion).toBe(1);
    expect(legacy.r32.left.map((match) => match.id)).toEqual([
      'L1',
      'L2',
      'L4',
      'R1',
      'L3',
      'R2',
      'R3',
      'R4',
    ]);
    // Son los mismos cruces que los del cuadro actual, colocados en el orden del sorteo.
    expect([...defaultBracketState.r32.left, ...defaultBracketState.r32.right]).toEqual(
      orderR32([...legacy.r32.left, ...legacy.r32.right], 2),
    );
  });

  it('reutiliza el cuadro vacío de un torneo con la misma forma', () => {
    const format = (): TournamentFormat => ({
      groups: ['A', 'B'],
      bestThirds: 0,
      thirdPlaceMatch: false,
      firstRound: 'sf',
      firstKnockoutRound: [
        ['1A', '2B'],
        ['1B', '2A'],
      ],
    });

    const empty = getDefaultBracketState(2, format());

    expect(getDefaultBracketState(2, format())).toBe(empty);
    expect(empty.qf).toEqual({ left: [], right: [] });
    expect(empty.sf).toEqual({
      left: [{ id: 'L2_0', home: { name: '1º Grupo A' }, away: { name: '2º Grupo B' } }],
      right: [{ id: 'R2_0', home: { name: '1º Grupo B' }, away: { name: '2º Grupo A' } }],
    });
  });
});

describe('estado al abrir la aplicación', () => {
  const freshStore = async () => {
    vi.resetModules();
    return (await import('../../store/useAppStore')).useAppStore.getState();
  };

  it('sin sesión descarta los datos del usuario anterior', async () => {
    localStorage.setItem('my_prediction_name', 'Ana');
    localStorage.setItem('my_user_id', '7');
    localStorage.setItem('my_avatar_url', 'https://x/a.png');

    const state = await freshStore();

    expect(state).toMatchObject({
      isAuthenticated: false,
      choosingLeague: false,
      userName: '',
      userId: '',
      userAvatarUrl: '',
    });
    expect(localStorage.getItem('my_user_id')).toBeNull();
  });

  it('con sesión recupera usuario, liga, competición y el borrador de su cuadro', async () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    localStorage.setItem('my_prediction_name', 'Ana');
    localStorage.setItem('my_user_id', '7');
    localStorage.setItem('activeGroupId', '10');
    localStorage.setItem('activeCompetitionId', '4');
    localStorage.setItem('draft_bracket_u7_g10', JSON.stringify(bracketWith('España')));

    const state = await freshStore();

    expect(state).toMatchObject({
      isAuthenticated: true,
      choosingLeague: false,
      userName: 'Ana',
      userId: '7',
      activeGroupId: '10',
      activeCompetitionId: 4,
    });
    expect(state.bracketState.champion).toEqual({ name: 'España' });
  });

  it('con sesión y sin liga guardada espera a que se elija una, salvo en la demo', async () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    expect((await freshStore()).choosingLeague).toBe(true);

    localStorage.setItem('isDemoMode', 'true');
    const demo = await freshStore();
    expect(demo).toMatchObject({ choosingLeague: false, isDemoMode: true });
  });
});
