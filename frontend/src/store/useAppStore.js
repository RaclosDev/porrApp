import { create } from 'zustand';

export const useAppStore = create((set) => ({
    userName: localStorage.getItem('my_bet_name') || '',
    setUserName: (name) => {
        localStorage.setItem('my_bet_name', name);
        set({ userName: name });
    },
    
    userToken: localStorage.getItem('auth_token') || '',
    setUserToken: (token) => {
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
        set({ userToken: token });
    },
    
    activeGroupId: localStorage.getItem('active_group_id') || '',
    setActiveGroupId: (groupId) => {
        if (groupId) {
            localStorage.setItem('active_group_id', groupId);
        } else {
            localStorage.removeItem('active_group_id');
        }
        set({ activeGroupId: groupId });
    },
    
    onlineUsers: [],
    setOnlineUsers: (users) => set({ onlineUsers: users }),
    
    selectedMatch: null,
    setSelectedMatch: (match) => set({ selectedMatch: match }),
    
    showBetsModal: false,
    setShowBetsModal: (show) => set({ showBetsModal: show }),
    
    showAddPointsModal: false,
    setShowAddPointsModal: (show) => set({ showAddPointsModal: show }),
    
    groupViewMatchId: null,
    setGroupViewMatchId: (id) => set({ groupViewMatchId: id }),
}));
