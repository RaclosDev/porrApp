import { useState, useEffect, useCallback } from 'react';
import {
  fetchMyGroups,
  createGroup,
  joinGroup,
  fetchGroup,
  leaveGroup,
  fetchCompetitions,
  updateGroup,
  deleteGroup,
} from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export const POOL_FORMATS = [
  { id: 'FULL_BRACKET', label: 'Completa (Fase de grupos y cruces)' },
  { id: 'KNOCKOUTS_ONLY', label: 'Bracket (Solo Cuadro Final)' },
  { id: 'MATCH_DAY', label: 'Por Jornadas' },
];
export const BET_MODES = POOL_FORMATS;

export function useGroupsDashboard() {
  const [groups, setGroups] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [selectedBetMode, setSelectedBetMode] = useState('');
  const [includePichichi, setIncludePichichi] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [visibleCodes, setVisibleCodes] = useState(new Set());

  const { changeGroup, userName, userId, activeGroupId } = useAppContext();
  const navigate = useNavigate();

  const loadGroupsAndCompetitions = useCallback(async () => {
    setLoading(true);
    try {
      const [myGroups, comps] = await Promise.all([
        fetchMyGroups(),
        fetchCompetitions().catch(() => []),
      ]);

      setCompetitions(comps);
      if (comps.length > 0) setSelectedCompetition(comps[0].id.toString());
      setSelectedBetMode(BET_MODES[0].id);

      const knownIds = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const missingIds = knownIds.filter(
        (id) => !myGroups.find((g) => g.id.toString() === id.toString()),
      );

      if (missingIds.length > 0) {
        try {
          const extraGroups = await Promise.all(
            missingIds.map((id) => fetchGroup(id).catch(() => null)),
          );
          const validExtras = extraGroups.filter((g) => g !== null && g !== undefined);
          myGroups.push(...validExtras);
        } catch (err) {
          console.warn('No se pudieron cargar grupos extra', err);
        }
      }

      if (myGroups.length === 1) {
        const onlyGroupId = myGroups[0].id.toString();
        if (activeGroupId !== onlyGroupId) {
          changeGroup(onlyGroupId);
        }
      }
      setGroups(myGroups);
    } catch (e) {
      console.error(e);
      setError('Error al cargar datos');
    }
    setLoading(false);
  }, [activeGroupId, changeGroup]);

  useEffect(() => {
    const checkPendingJoin = async () => {
      const pendingCode = localStorage.getItem('pendingJoinCode');
      if (pendingCode) {
        localStorage.removeItem('pendingJoinCode');
        try {
          const group = await joinGroup(pendingCode);
          const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
          if (!knownGroups.includes(group.id.toString())) {
            knownGroups.push(group.id.toString());
            localStorage.setItem('knownGroups', JSON.stringify(knownGroups));
          }
          alert(`¡Te has unido correctamente a la liga "${group.name}" a través de la invitación!`);
          changeGroup(group.id.toString());
          navigate('/bracket');
        } catch (e) {
          setError(e.message);
        }
      } else {
        loadGroupsAndCompetitions();
      }
    };

    if (userName) {
      checkPendingJoin();
    } else {
      setTimeout(() => setLoading(false), 0);
    }
  }, [userName, changeGroup, navigate, loadGroupsAndCompetitions]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !selectedCompetition || !selectedBetMode) {
      setError('El nombre del grupo y la competición son obligatorios');
      return;
    }
    try {
      const group = await createGroup(
        newGroupName,
        selectedCompetition,
        selectedBetMode,
        includePichichi,
      );
      setNewGroupName('');
      changeGroup(group.id.toString());
      loadGroupsAndCompetitions();
    } catch (e) {
      setError(e.message || 'Error al crear el grupo');
    }
  };

  const handleEditGroup = async (groupId, currentName) => {
    const newName = prompt('Introduce el nuevo nombre para la liga:', currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;

    try {
      await updateGroup(groupId, newName);
      loadGroupsAndCompetitions();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (
      !window.confirm(
        `⚠️ ADVERTENCIA ⚠️\n¿Estás seguro de que quieres BORRAR POR COMPLETO la liga "${groupName}"?\n\nEsta acción eliminará todos los pronósticos de todos los participantes y no se puede deshacer.`,
      )
    )
      return;

    try {
      await deleteGroup(groupId);
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const updatedKnownGroups = knownGroups.filter((id) => id.toString() !== groupId.toString());
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));

      if (activeGroupId === groupId.toString()) {
        changeGroup(null);
      }

      loadGroupsAndCompetitions();
      alert(`La liga "${groupName}" ha sido eliminada permanentemente.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const group = await joinGroup(joinCode);

      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      if (!knownGroups.includes(group.id.toString())) {
        knownGroups.push(group.id.toString());
        localStorage.setItem('knownGroups', JSON.stringify(knownGroups));
      }

      alert(
        `¡Te has unido correctamente a la liga "${group.name}"! Ahora rellena y envía tu porra para participar.`,
      );
      changeGroup(group.id.toString());
      navigate('/bracket');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEnterGroup = (groupId) => {
    changeGroup(groupId.toString());
    navigate('/');
  };

  const handleLeaveGroup = async (groupId, groupName) => {
    if (
      !window.confirm(
        `¿Estás seguro de que quieres abandonar la liga "${groupName}"? Perderás tus porras en esta liga.`,
      )
    )
      return;
    try {
      await leaveGroup(groupId);
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const updatedKnownGroups = knownGroups.filter((id) => id.toString() !== groupId.toString());
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));

      loadGroupsAndCompetitions();
      alert(`Has abandonado la liga "${groupName}".`);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleCodeVisibility = (groupId) => {
    setVisibleCodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Código "${code}" copiado al portapapeles.`);
  };

  const handleCopyLink = (code) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    alert(`Enlace de invitación copiado al portapapeles.`);
  };

  return {
    groups,
    competitions,
    loading,
    error,
    newGroupName,
    setNewGroupName,
    selectedCompetition,
    setSelectedCompetition,
    selectedBetMode,
    setSelectedBetMode,
    includePichichi,
    setIncludePichichi,
    joinCode,
    setJoinCode,
    visibleCodes,
    toggleCodeVisibility,
    handleCreate,
    handleJoin,
    handleEditGroup,
    handleDeleteGroup,
    handleEnterGroup,
    handleLeaveGroup,
    handleCopyCode,
    handleCopyLink,
    userName,
    userId,
    activeGroupId,
  };
}
