import { create } from 'zustand';
import { updateUserPreferences } from '../services/api';
import { GLOBAL_LEAGUE_ID, DEMO_COMPETITION_ID } from '../utils/constants';

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

export interface BracketSide {
  left: BracketMatch[];
  right: BracketMatch[];
}

/** Cuadro de eliminatorias que rellena el usuario. */
export interface BracketState {
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
  userName: string;
  setUserName: (userName: string) => void;
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
  isDemoMode: boolean;
  setIsDemoMode: (isDemoMode: boolean) => void;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  /** Cambia de liga guardando el borrador del cuadro de la anterior. */
  changeGroup: (groupId: string | number | null) => void;
}

export const defaultBracketState: BracketState = {
  r32: {
    left: [
      { home: { name: '1º Grupo E' }, away: { name: '3º A/B/C/D/F' }, id: 'L1' },
      { home: { name: '1º Grupo I' }, away: { name: '3º C/D/F/G/H' }, id: 'L2' },
      { home: { name: '1º Grupo F' }, away: { name: '2º Grupo C' }, id: 'L4' },
      { home: { name: '1º Grupo C' }, away: { name: '2º Grupo F' }, id: 'R1' },
      { home: { name: '2º Grupo A' }, away: { name: '2º Grupo B' }, id: 'L3' },
      { home: { name: '2º Grupo E' }, away: { name: '2º Grupo I' }, id: 'R2' },
      { home: { name: '1º Grupo A' }, away: { name: '3º C/E/F/H/I' }, id: 'R3' },
      { home: { name: '1º Grupo L' }, away: { name: '3º E/H/I/J/K' }, id: 'R4' },
    ],
    right: [
      { home: { name: '2º Grupo K' }, away: { name: '2º Grupo L' }, id: 'L5' },
      { home: { name: '1º Grupo H' }, away: { name: '2º Grupo J' }, id: 'L6' },
      { home: { name: '1º Grupo D' }, away: { name: '3º B/E/F/I/J' }, id: 'L7' },
      { home: { name: '1º Grupo G' }, away: { name: '3º A/E/H/I/J' }, id: 'L8' },
      { home: { name: '1º Grupo J' }, away: { name: '2º Grupo H' }, id: 'R5' },
      { home: { name: '2º Grupo D' }, away: { name: '2º Grupo G' }, id: 'R6' },
      { home: { name: '1º Grupo B' }, away: { name: '3º E/F/G/I/J' }, id: 'R7' },
      { home: { name: '1º Grupo K' }, away: { name: '3º D/E/I/J/L' }, id: 'R8' },
    ],
  },
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

export const getInitialBracketState = (groupId: string): BracketState => {
  if (!groupId || typeof window === 'undefined') return defaultBracketState;
  try {
    const saved = localStorage.getItem(`draft_bracket_${groupId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && parsed.r32) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error parsing bracket from localStorage, using default:', e);
  }
  return defaultBracketState;
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

const initialGroupId =
  typeof window !== 'undefined' ? localStorage.getItem('activeGroupId') || '' : '';

export const useAppStore = create<AppState>((set, get) => ({
  userName: localStorage.getItem('my_prediction_name') || '',
  setUserName: (userName) => {
    if (userName) {
      localStorage.setItem('my_prediction_name', userName);
    } else {
      localStorage.removeItem('my_prediction_name');
    }
    set({ userName });
  },

  userAvatarUrl: localStorage.getItem('my_avatar_url') || '',
  setUserAvatarUrl: (userAvatarUrl) => {
    if (userAvatarUrl) {
      localStorage.setItem('my_avatar_url', userAvatarUrl);
    } else {
      localStorage.removeItem('my_avatar_url');
    }
    set({ userAvatarUrl: userAvatarUrl || '' });
  },

  userId: localStorage.getItem('my_user_id') || '',
  setUserId: (userId) => set({ userId }),

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

  bracketState: getInitialBracketState(initialGroupId),
  setBracketState: (bracketState) => set({ bracketState }),

  topScorer: '',
  setTopScorer: (topScorer) => set({ topScorer }),

  viewerPredictionId: null,
  setViewerPredictionId: (id) => set({ viewerPredictionId: id }),

  isAuthenticated: !!localStorage.getItem('token'),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  isDemoMode: localStorage.getItem('isDemoMode') === 'true',
  setIsDemoMode: (isDemoMode) => {
    if (isDemoMode) {
      localStorage.setItem('isDemoMode', 'true');
    } else {
      localStorage.removeItem('isDemoMode');
    }
    set({ isDemoMode });
  },

  enterDemoMode: () => {
    localStorage.setItem('isDemoMode', 'true');
    localStorage.setItem('activeGroupId', GLOBAL_LEAGUE_ID);
    localStorage.setItem('activeCompetitionId', String(DEMO_COMPETITION_ID));
    set({
      isDemoMode: true,
      activeGroupId: GLOBAL_LEAGUE_ID,
      activeCompetitionId: DEMO_COMPETITION_ID,
      viewerPredictionId: null,
    });
  },

  exitDemoMode: () => {
    localStorage.removeItem('isDemoMode');
    localStorage.setItem('activeGroupId', GLOBAL_LEAGUE_ID);
    localStorage.removeItem('activeCompetitionId');
    localStorage.removeItem('my_prediction_name');
    localStorage.removeItem('my_user_id');
    set({
      isDemoMode: false,
      isAuthenticated: false,
      userName: '',
      userId: '',
      activeGroupId: GLOBAL_LEAGUE_ID,
      activeCompetitionId: null,
      viewerPredictionId: null,
    });
  },

  changeGroup: (groupId) => {
    const nextGroupId = groupId ? groupId.toString() : '';
    const current = get();
    if (current.activeGroupId === nextGroupId) return;
    if (current.activeGroupId) {
      try {
        localStorage.setItem(
          `draft_bracket_${current.activeGroupId}`,
          JSON.stringify(current.bracketState),
        );
      } catch {
        /* ignore */
      }
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

    const parsedBracket = getInitialBracketState(groupId ? groupId.toString() : '');
    set({
      activeGroupId: groupId ? groupId.toString() : '',
      activeCompetitionId: null,
      bracketState: parsedBracket,
      topScorer: '',
      viewerPredictionId: null,
    });
  },
}));
