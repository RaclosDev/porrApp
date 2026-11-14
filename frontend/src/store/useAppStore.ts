import { create } from 'zustand';
import { endSession, updateUserPreferences } from '../services/api';
import { hasStoredSession } from '../services/sessionHint';
import { queryClient } from '../services/queryClient';
import { unsubscribeThisDevice } from '../services/push';
import { clearAllDrafts, readJsonDraft, writeDraft } from '../utils/drafts';
import { isBracketState } from '../utils/bracketValidation';
import { orderR32, topologyVersion, type TopologyVersion } from '../utils/bracketTopology';
import {
  BRACKET_ROUNDS,
  WORLD_CUP_2026_FIRST_ROUND,
  firstRoundInLegacyOrder,
  firstRoundLabels,
} from '../utils/firstKnockoutRound';
import type { TournamentFormat } from '../types/api';

/** Equipo colocado en un hueco del cuadro (o la descripción del hueco, p. ej. "1º Grupo E"). */
export interface BracketTeam {
  name: string;
  [extra: string]: unknown;
}

export interface BracketMatch {
  id: string;
  home: BracketTeam | null;
  away: BracketTeam | null;
}

interface BracketSide {
  left: BracketMatch[];
  right: BracketMatch[];
}

/**
 * Cuadro de eliminatorias que rellena el usuario. Las rondas que el torneo no juega (los
 * dieciseisavos de uno que empieza en octavos) quedan sin cruces.
 */
export interface BracketState {
  topologyVersion?: TopologyVersion;
  r32: BracketSide;
  r16: BracketSide;
  qf: BracketSide;
  sf: BracketSide;
  final: BracketMatch | null;
  champion: BracketTeam | null;
  thirdPlaceMatch: BracketMatch | null;
  thirdPlaceWinner: BracketTeam | null;
}

interface AppState {
  profileSetupCompleted: boolean | null;
  setProfileSetupCompleted: (completed: boolean) => void;
  userName: string;
  setUserName: (userName: string) => void;
  /** El servidor ya ha contestado (o fallado) al pedir el perfil de la sesión abierta. */
  profileChecked: boolean;
  setProfileChecked: (profileChecked: boolean) => void;
  /** La cuenta puede abrir el panel de gestión (lo dice el servidor). */
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  userAvatarUrl: string;
  setUserAvatarUrl: (url: string | null) => void;
  userId: string;
  setUserId: (userId: string) => void;
  activeGroupId: string;
  setActiveGroupId: (groupId: string | null) => void;
  activeCompetitionId: number | null;
  setActiveCompetitionId: (competitionId: number | null) => void;
  bracketState: BracketState;
  setBracketState: (bracketState: BracketState) => void;
  topScorer: string;
  setTopScorer: (topScorer: string) => void;
  viewerPredictionId: string | number | null;
  setViewerPredictionId: (id: string | number | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  /**
   * Con sesión pero sin liga guardada en este dispositivo (primera vez en él o datos borrados):
   * aún se está eligiendo qué liga abrir, así que la portada y la navegación esperan.
   */
  choosingLeague: boolean;
  setChoosingLeague: (choosingLeague: boolean) => void;
  isDemoMode: boolean;
  setIsDemoMode: (isDemoMode: boolean) => void;
  /** Entra en la demo; sin liga, AppContext abre la liga pública destacada. */
  enterDemoMode: (groupId?: string | null) => void;
  exitDemoMode: () => void;
  /**
   * Cierra la sesión: la revoca en el servidor, olvida el token, borra los datos del usuario,
   * la liga activa y los borradores de localStorage, vacía la caché de consultas y deja el
   * store como recién abierto.
   * Es la única forma de cerrar sesión (menú de perfil, token caducado y salida de la demo).
   */
  logout: () => void;
  /** Cambia de liga guardando el borrador del cuadro de la anterior. */
  changeGroup: (groupId: string | number | null) => void;
}

/** Identificadores de los cruces de dieciseisavos en el orden antiguo del cuadro. */
const LEGACY_R32_IDS = [
  ['L1', 'L2', 'L4', 'R1', 'L3', 'R2', 'R3', 'R4'],
  ['L5', 'L6', 'L7', 'L8', 'R5', 'R6', 'R7', 'R8'],
];
const legacyR32Labels = firstRoundLabels(firstRoundInLegacyOrder(WORLD_CUP_2026_FIRST_ROUND));
const legacyR32Side = (side: number): BracketMatch[] =>
  LEGACY_R32_IDS[side].map((id, index) => {
    const [home, away] = legacyR32Labels[side * 8 + index];
    return { home: { name: home }, away: { name: away }, id };
  });

const legacyBracketState: BracketState = {
  topologyVersion: 1,
  r32: { left: legacyR32Side(0), right: legacyR32Side(1) },
  r16: {
    left: Array(4)
      .fill(null)
      .map((_, i) => ({ home: null, away: null, id: `L8_${i}` })),
    right: Array(4)
      .fill(null)
      .map((_, i) => ({ home: null, away: null, id: `R8_${i}` })),
  },
  qf: {
    left: Array(2)
      .fill(null)
      .map((_, i) => ({ home: null, away: null, id: `L4_${i}` })),
    right: Array(2)
      .fill(null)
      .map((_, i) => ({ home: null, away: null, id: `R4_${i}` })),
  },
  sf: {
    left: [{ home: null, away: null, id: 'L2_0' }],
    right: [{ home: null, away: null, id: 'R2_0' }],
  },
  final: null,
  champion: null,
  thirdPlaceMatch: null,
  thirdPlaceWinner: null,
};

const canonicalR32 = orderR32([...legacyBracketState.r32.left, ...legacyBracketState.r32.right], 2);
export const defaultBracketState: BracketState = {
  ...legacyBracketState,
  topologyVersion: 2,
  r32: { left: canonicalR32.slice(0, 8), right: canonicalR32.slice(8) },
};

/** Cruces por lado de cada ronda de un cuadro completo, y cómo empiezan sus identificadores. */
const SIDE_SIZES = [8, 4, 2, 1];
const ID_PREFIXES = ['', '8', '4', '2'];

/** Cuadro vacío de un torneo: su primera ronda con los huecos de grupo y el resto por rellenar. */
function emptyBracketOf(format: TournamentFormat): BracketState {
  const start = Math.max(0, BRACKET_ROUNDS.indexOf(format.firstRound));
  const labels = firstRoundLabels(format.firstKnockoutRound);
  const half = labels.length / 2;
  const side = (round: number, right: boolean): BracketMatch[] => {
    if (round < start) return [];
    const letter = right ? 'R' : 'L';
    if (round > start) {
      return Array.from({ length: SIDE_SIZES[round] }, (_, index) => ({
        home: null,
        away: null,
        id: `${letter}${ID_PREFIXES[round]}_${index}`,
      }));
    }
    return labels
      .slice(right ? half : 0, right ? labels.length : half)
      .map(([home, away], index) => ({
        home: { name: home },
        away: { name: away },
        id: `${letter}${ID_PREFIXES[round]}_${index}`,
      }));
  };
  const round = (index: number): BracketSide => ({
    left: side(index, false),
    right: side(index, true),
  });
  return {
    topologyVersion: 2,
    r32: round(0),
    r16: round(1),
    qf: round(2),
    sf: round(3),
    final: null,
    champion: null,
    thirdPlaceMatch: null,
    thirdPlaceWinner: null,
  };
}

const usesDefaultFirstRound = (format: TournamentFormat | undefined) =>
  !format ||
  JSON.stringify(format.firstKnockoutRound) === JSON.stringify(WORLD_CUP_2026_FIRST_ROUND);

const emptyBrackets = new Map<string, BracketState>();

/**
 * Cuadro vacío del torneo (sin forma, el del Mundial). Los cuadros del Mundial anteriores a la
 * versión 2 conservan su orden antiguo.
 */
export const getDefaultBracketState = (
  version?: TopologyVersion,
  format?: TournamentFormat,
): BracketState => {
  if (usesDefaultFirstRound(format)) {
    return topologyVersion(version) === 2 ? defaultBracketState : legacyBracketState;
  }
  const key = JSON.stringify(format);
  let empty = emptyBrackets.get(key);
  if (!empty) {
    empty = emptyBracketOf(format as TournamentFormat);
    emptyBrackets.set(key, empty);
  }
  return empty;
};

/** Borrador del cuadro de este usuario en esta liga, o el cuadro vacío. */
export const getInitialBracketState = (groupId: string, userId: string): BracketState => {
  if (!groupId || typeof window === 'undefined') return defaultBracketState;
  const parsed = readJsonDraft('bracket', groupId, userId);
  return isBracketState(parsed) ? parsed : defaultBracketState;
};

/** Mapa local liga -> timestamp de la última vez que se abrió, para ordenar "Mis Ligas". */
export const readGroupVisits = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('group_last_visited');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** Quita una liga del mapa de visitas (ya no es del usuario). */
export const forgetGroupVisit = (groupId: string) => {
  const visits = readGroupVisits();
  if (!(groupId in visits)) return;
  delete visits[groupId];
  try {
    localStorage.setItem('group_last_visited', JSON.stringify(visits));
  } catch {
    /* ignore */
  }
};

/** Claves de localStorage que pertenecen a la sesión del usuario. */
const SESSION_KEYS = [
  'my_prediction_name',
  'my_user_id',
  'my_avatar_url',
  'activeGroupId',
  'activeCompetitionId',
  'isDemoMode',
];

// Sin sesión, los datos de un usuario anterior no son de nadie.
if (typeof window !== 'undefined' && !hasStoredSession()) {
  ['my_prediction_name', 'my_user_id', 'my_avatar_url'].forEach((k) => localStorage.removeItem(k));
}

const initialGroupId =
  typeof window !== 'undefined' ? localStorage.getItem('activeGroupId') || '' : '';
const initialUserId = typeof window !== 'undefined' ? localStorage.getItem('my_user_id') || '' : '';

export const useAppStore = create<AppState>((set, get) => ({
  profileSetupCompleted: null,
  setProfileSetupCompleted: (completed) =>
    set((state) => ({ profileSetupCompleted: state.profileSetupCompleted === true || completed })),
  profileChecked: false,
  setProfileChecked: (profileChecked) => set({ profileChecked }),
  userName: localStorage.getItem('my_prediction_name') || '',
  setUserName: (userName) => {
    if (userName) {
      localStorage.setItem('my_prediction_name', userName);
    } else {
      localStorage.removeItem('my_prediction_name');
    }
    set({ userName });
  },

  isAdmin: false,
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  userAvatarUrl: localStorage.getItem('my_avatar_url') || '',
  setUserAvatarUrl: (userAvatarUrl) => {
    if (userAvatarUrl) {
      localStorage.setItem('my_avatar_url', userAvatarUrl);
    } else {
      localStorage.removeItem('my_avatar_url');
    }
    set({ userAvatarUrl: userAvatarUrl || '' });
  },

  userId: initialUserId,
  setUserId: (userId) => {
    const current = get();
    if (current.userId === userId) return;
    // Copia local para cargar los borradores al arrancar; la fuente es /api/users/me.
    if (userId) {
      localStorage.setItem('my_user_id', userId);
    } else {
      localStorage.removeItem('my_user_id');
    }
    // El borrador del cuadro es de cada usuario: al cambiar de usuario se carga el suyo.
    set({
      userId,
      profileSetupCompleted: null,
      bracketState: getInitialBracketState(current.activeGroupId, userId),
    });
  },

  activeGroupId: initialGroupId,
  setActiveGroupId: (activeGroupId) => {
    if (activeGroupId) {
      localStorage.setItem('activeGroupId', activeGroupId);
    } else {
      localStorage.removeItem('activeGroupId');
    }
    set({ activeGroupId: activeGroupId || '' });
  },

  activeCompetitionId:
    typeof window !== 'undefined' && localStorage.getItem('activeCompetitionId')
      ? Number(localStorage.getItem('activeCompetitionId'))
      : null,
  setActiveCompetitionId: (activeCompetitionId) => {
    if (activeCompetitionId != null) {
      localStorage.setItem('activeCompetitionId', activeCompetitionId.toString());
    } else {
      localStorage.removeItem('activeCompetitionId');
    }
    set({ activeCompetitionId });
  },

  bracketState: getInitialBracketState(initialGroupId, initialUserId),
  setBracketState: (bracketState) => set({ bracketState }),

  topScorer: '',
  setTopScorer: (topScorer) => set({ topScorer }),

  viewerPredictionId: null,
  setViewerPredictionId: (id) => set({ viewerPredictionId: id }),

  // Optimista: la sesión se comprueba con el servidor al arrancar (initSession).
  isAuthenticated: hasStoredSession(),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  choosingLeague:
    hasStoredSession() && !initialGroupId && localStorage.getItem('isDemoMode') !== 'true',
  setChoosingLeague: (choosingLeague) => set({ choosingLeague }),

  isDemoMode: localStorage.getItem('isDemoMode') === 'true',
  setIsDemoMode: (isDemoMode) => {
    if (isDemoMode) {
      localStorage.setItem('isDemoMode', 'true');
    } else {
      localStorage.removeItem('isDemoMode');
    }
    set({ isDemoMode });
  },

  enterDemoMode: (groupId = null) => {
    const nextGroupId = groupId ?? '';
    localStorage.setItem('isDemoMode', 'true');
    if (nextGroupId) localStorage.setItem('activeGroupId', nextGroupId);
    else localStorage.removeItem('activeGroupId');
    localStorage.removeItem('activeCompetitionId');
    set({
      isDemoMode: true,
      activeGroupId: nextGroupId,
      activeCompetitionId: null,
      viewerPredictionId: null,
    });
  },

  exitDemoMode: () => {
    get().logout();
    localStorage.removeItem('activeGroupId');
    set({ activeGroupId: '' });
  },

  logout: () => {
    void unsubscribeThisDevice().catch(() => undefined);
    endSession();
    SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
    clearAllDrafts();
    queryClient.clear();
    set({
      isAuthenticated: false,
      choosingLeague: false,
      isDemoMode: false,
      userName: '',
      userId: '',
      userAvatarUrl: '',
      isAdmin: false,
      profileSetupCompleted: null,
      activeGroupId: '',
      activeCompetitionId: null,
      bracketState: defaultBracketState,
      topScorer: '',
      viewerPredictionId: null,
    });
  },

  changeGroup: (groupId) => {
    const nextGroupId = groupId ? groupId.toString() : '';
    const current = get();
    if (current.activeGroupId === nextGroupId) return;
    if (current.activeGroupId) {
      writeDraft('bracket', current.activeGroupId, current.userId, current.bracketState);
    }
    localStorage.removeItem('activeCompetitionId');
    if (groupId) {
      localStorage.setItem('activeGroupId', groupId.toString());
      try {
        const visits = readGroupVisits();
        visits[groupId.toString()] = Date.now();
        localStorage.setItem('group_last_visited', JSON.stringify(visits));
      } catch {
        /* ignore */
      }
      try {
        const num = Number(groupId);
        if (!isNaN(num) && num > 0) {
          updateUserPreferences({ lastSelectedGroupId: num }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    } else {
      localStorage.removeItem('activeGroupId');
    }

    const parsedBracket = getInitialBracketState(nextGroupId, current.userId);
    set({
      activeGroupId: groupId ? groupId.toString() : '',
      activeCompetitionId: null,
      bracketState: parsedBracket,
      topScorer: '',
      viewerPredictionId: null,
    });
  },
}));
