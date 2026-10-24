import { useState, useEffect, useMemo } from 'react';
import {
  fetchConnectionHistory,
  setAdminToken,
  getAdminToken,
  deleteConnectionLog,
  fetchRegisteredUsers,
} from '../services/api';
import { useAppContext } from '../context/AppContext';

const API_BASE = '/api';

export function useAdminData() {
  const { isRaclos, isAdminAuthenticated, setIsAdminAuthenticated } = useAppContext();
  const [history, setHistory] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [refreshStatus, setRefreshStatus] = useState({});
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    setTimeout(() => setLoading(true), 0);
    Promise.allSettled([
      fetchConnectionHistory().then((data) => {
        if (data) setHistory(data);
      }),
      fetchRegisteredUsers().then((data) => {
        if (data) setRegisteredUsers(data);
      }),
    ]).finally(() => {
      setLoading(false);
    });
  }, [isAdminAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminToken(data.token);
        setIsAdminAuthenticated(true);
      } else {
        setLoginError('Contraseña incorrecta');
      }
    } catch {
      setLoginError('Error de red');
    }
  };

  const handleRefresh = async (key, endpoint) => {
    setRefreshStatus((s) => ({ ...s, [key]: 'loading' }));
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/${endpoint}/refresh`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = res.ok ? await res.json() : null;
      setRefreshStatus((s) => ({ ...s, [key]: result ? 'ok' : 'error' }));
    } catch {
      setRefreshStatus((s) => ({ ...s, [key]: 'error' }));
    }
    setTimeout(() => setRefreshStatus((s) => ({ ...s, [key]: null })), 3000);
  };

  const handleSnapshot = async () => {
    setRefreshStatus((s) => ({ ...s, snapshot: 'loading' }));
    try {
      const res = await fetch(`${API_BASE}/admin/backups/snapshot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAdminToken() || ''}` },
      });
      setRefreshStatus((s) => ({ ...s, snapshot: res.ok ? 'ok' : 'error' }));
    } catch {
      setRefreshStatus((s) => ({ ...s, snapshot: 'error' }));
    }
    setTimeout(() => setRefreshStatus((s) => ({ ...s, snapshot: null })), 3000);
  };

  const handleLogout = () => {
    setAdminToken(null);
    setIsAdminAuthenticated(false);
  };

  const unifiedUsers = useMemo(() => {
    const usersMap = {};

    registeredUsers.forEach((u) => {
      usersMap[u.participantName] = {
        name: u.participantName,
        googleEmail: u.googleEmail,
        googleName: u.googleName,
        allConnections: [],
        lastConnection: null,
      };
    });

    history.forEach((log) => {
      if (!usersMap[log.participantName]) {
        usersMap[log.participantName] = {
          name: log.participantName,
          googleEmail: null,
          googleName: null,
          allConnections: [],
          lastConnection: null,
        };
      }
      usersMap[log.participantName].allConnections.push(log);
    });

    return Object.values(usersMap)
      .map((user) => {
        user.allConnections.sort((a, b) => new Date(b.connectedAt) - new Date(a.connectedAt));
        if (user.allConnections.length > 0) {
          user.lastConnection = user.allConnections[0].connectedAt;
        }
        return user;
      })
      .sort((a, b) => {
        if (!a.lastConnection && !b.lastConnection) return a.name.localeCompare(b.name);
        if (!a.lastConnection) return 1;
        if (!b.lastConnection) return -1;
        return new Date(b.lastConnection) - new Date(a.lastConnection);
      });
  }, [history, registeredUsers]);

  const handleDeleteLog = async (id) => {
    try {
      const res = await deleteConnectionLog(id);
      if (res.ok) {
        setHistory((prev) => prev.filter((log) => log.id !== id));
      }
    } catch (e) {
      console.error('Error al borrar registro', e);
    }
  };

  return {
    isRaclos,
    isAdminAuthenticated,
    loading,
    expandedUser,
    setExpandedUser,
    refreshStatus,
    password,
    setPassword,
    loginError,
    handleLogin,
    handleRefresh,
    handleSnapshot,
    handleLogout,
    unifiedUsers,
    handleDeleteLog,
  };
}
