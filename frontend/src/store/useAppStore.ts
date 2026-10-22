import { create } from 'zustand';

export const defaultBracketState = {
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

export const useAppStore = create((set) => ({
  userName: localStorage.getItem('my_bet_name') || '',
  setUserName: (userName) => set({ userName }),

  userId: localStorage.getItem('my_user_id') || '',
  setUserId: (userId) => set({ userId }),

  activeGroupId: localStorage.getItem('activeGroupId') || '1',
  setActiveGroupId: (activeGroupId) => {
    localStorage.setItem('activeGroupId', activeGroupId);
    set({ activeGroupId });
  },

  bracketState: defaultBracketState,
  setBracketState: (bracketState) => set({ bracketState }),

  topScorer: '',
  setTopScorer: (topScorer) => set({ topScorer }),

  viewerBetId: null,
  setViewerBetId: (viewerBetId) => set({ viewerBetId }),

  isAdminAuthenticated: !!localStorage.getItem('adminToken') || !!window.adminToken,
  setIsAdminAuthenticated: (isAdminAuthenticated) => set({ isAdminAuthenticated }),

  changeGroup: (groupId) => {
    localStorage.setItem('activeGroupId', groupId);
    const saved = localStorage.getItem(`draft_bracket_${groupId}`);
    set({
      activeGroupId: groupId,
      bracketState: saved ? JSON.parse(saved) : defaultBracketState,
    });
  },
}));
