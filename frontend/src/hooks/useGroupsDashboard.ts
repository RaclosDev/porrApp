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
  { id: 'MATCH_DAY', label: 'Por Jornadas (1X2 y Marcador Exacto)' },
  { id: 'FULL_BRACKET', label: 'Completa (Fase de grupos y cruces)' },
  { id: 'KNOCKOUTS_ONLY', label: 'Bracket (Solo Cuadro Final)' },
];
export const BET_MODES = POOL_FORMATS;

export const PRESET_TEMPLATES = [
  {
    id: 'MATCH_DAY_LEAGUE',
    name: 'Liga Jornada a Jornada',
    icon: '⚡',
    badge: 'Recomendada',
    poolFormat: 'MATCH_DAY',
    pichichi: false,
    tagline: 'Ideal para ligas de fútbol (LaLiga, Premier, Champions)',
    description:
      'Pronósticos partido a partido con cierre individual. 3 pts por signo (1X2) y +2 pts por marcador exacto.',
  },
  {
    id: 'WORLD_CUP_FULL',
    name: 'Mundial 2026 Completo',
    icon: '🏆',
    badge: 'Torneo',
    poolFormat: 'FULL_BRACKET',
    pichichi: true,
    tagline: 'Fase de grupos + eliminatorias + Pichichi oficial',
    description:
      'Cuadro clasificatorio completo con puntuación escalonada y Pichichi oficial (200 pts).',
  },
  {
    id: 'KNOCKOUT_BRACKET',
    name: 'Solo Eliminatorias',
    icon: '🎯',
    badge: 'Rápido',
    poolFormat: 'KNOCKOUTS_ONLY',
    pichichi: false,
    tagline: 'Pronósticos directos de cruces eliminatorios',
    description: 'Pronostica las rondas eliminatorias desde octavos de final hasta la final.',
  },
];

export function useGroupsDashboard() {
  const { changeGroup, userName, userId, activeGroupId, userGroups } = useAppContext();
  const [groups, setGroups] = useState(userGroups && userGroups.length > 0 ? userGroups : []);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(!userGroups || userGroups.length === 0);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [selectedBetMode, setSelectedBetMode] = useState('MATCH_DAY');
  const [includePichichi, setIncludePichichi] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('MATCH_DAY_LEAGUE');
  const [wizardStep, setWizardStep] = useState(1);
  const [newlyCreatedGroup, setNewlyCreatedGroup] = useState(null);
  const [pendingJoinCodeNotice, setPendingJoinCodeNotice] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [visibleCodes, setVisibleCodes] = useState(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (userGroups && userGroups.length > 0) {
      setGroups(userGroups);
      setLoading(false);
    }
  }, [userGroups]);

  const loadGroupsAndCompetitions = useCallback(async () => {
    // Only show full loading spinner if we don't already have groups in memory
    setLoading((prev) => (groups.length > 0 ? false : prev));
    setError('');
    try {
      const [myGroups, comps] = await Promise.all([
        fetchMyGroups().catch((err) => {
          console.warn('No se pudieron obtener las ligas del usuario', err);
          return [];
        }),
        fetchCompetitions().catch(() => []),
      ]);

      setCompetitions(comps);
      if (comps.length > 0) {
        setSelectedCompetition((prev) => (prev ? prev : comps[0].id.toString()));
      }

      let knownIds = [];
      try {
        knownIds = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      } catch {
        knownIds = [];
      }
      const missingIds = Array.isArray(knownIds)
        ? knownIds.filter((id) => !myGroups.find((g) => g.id.toString() === id.toString()))
        : [];

      if (missingIds.length > 0) {
        try {
          const invalidIds = [];
          const extraGroups = await Promise.all(
            missingIds.map((id) =>
              fetchGroup(id).catch(() => {
                invalidIds.push(id.toString());
                return null;
              }),
            ),
          );
          if (invalidIds.length > 0) {
            try {
              const current = JSON.parse(localStorage.getItem('knownGroups') || '[]');
              const pruned = current.filter((x) => !invalidIds.includes(x.toString()));
              localStorage.setItem('knownGroups', JSON.stringify(pruned));
            } catch {
              /* ignore */
            }
          }
          const validExtras = extraGroups.filter((g) => g !== null && g !== undefined);
          myGroups.push(...validExtras);
        } catch (err) {
          console.warn('No se pudieron cargar grupos extra', err);
        }
      }

      if (myGroups.length === 1) {
        const onlyGroupId = myGroups[0].id.toString();
        const currentActive = localStorage.getItem('activeGroupId');
        if (currentActive !== onlyGroupId) {
          changeGroup(onlyGroupId);
        }
      }
      setGroups(myGroups);
    } catch (e) {
      console.error(e);
      setError('Error al cargar datos');
    }
    setLoading(false);
  }, [changeGroup]);

  useEffect(() => {
    const pending = localStorage.getItem('pendingJoinCode');
    if (pending) {
      setPendingJoinCodeNotice(pending);
    }
  }, []);

  useEffect(() => {
    const checkPendingJoin = async () => {
      const pendingCode = localStorage.getItem('pendingJoinCode');
      if (pendingCode) {
        localStorage.removeItem('pendingJoinCode');
        setPendingJoinCodeNotice('');
        try {
          const group = await joinGroup(pendingCode);
          const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
          if (!knownGroups.includes(group.id.toString())) {
            knownGroups.push(group.id.toString());
            localStorage.setItem('knownGroups', JSON.stringify(knownGroups));
          }
          alert(`¡Te has unido correctamente a la liga "${group.name}" a través de la invitación!`);
          changeGroup(group.id.toString());
          if (group.poolFormat === 'MATCH_DAY') {
            navigate('/jornadas');
          } else {
            navigate('/bracket');
          }
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

  const selectTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const tmpl = PRESET_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setSelectedBetMode(tmpl.poolFormat);
      setIncludePichichi(tmpl.pichichi);
      if (tmpl.id === 'WORLD_CUP_FULL' && competitions.length > 0) {
        const wc = competitions.find(
          (c) =>
            c.name.toLowerCase().includes('world cup') || c.name.toLowerCase().includes('mundial'),
        );
        if (wc) setSelectedCompetition(wc.id.toString());
      }
    }
  };

  const handleCreate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isCreating) return;
    if (!newGroupName.trim() || !selectedCompetition || !selectedBetMode) {
      setError('El nombre del grupo y la competición son obligatorios');
      return;
    }
    setIsCreating(true);
    try {
      const group = await createGroup(
        newGroupName.trim(),
        selectedCompetition,
        selectedBetMode,
        includePichichi,
      );
      setNewGroupName('');
      setNewlyCreatedGroup(group);
      changeGroup(group.id.toString());
      loadGroupsAndCompetitions();
    } catch (e) {
      setError(e.message || 'Error al crear el grupo');
    } finally {
      setIsCreating(false);
    }
  };

  const handleShareWhatsApp = (group) => {
    if (!group || !group.joinCode) return;
    const link = `${window.location.origin}/join/${group.joinCode}`;
    const text = `⚽ ¡Únete a mi porra "${group.name}" en PorrApp!\n\nEntra con este enlace: ${link}\nO introduce el código: *${group.joinCode}*`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
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

      alert(`¡Te has unido correctamente a la liga "${group.name}"!`);
      setJoinCode('');
      changeGroup(group.id.toString());
      loadGroupsAndCompetitions();
      if (group.poolFormat === 'MATCH_DAY') {
        navigate('/jornadas');
      } else {
        navigate('/bracket');
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEnterGroup = (groupId) => {
    changeGroup(groupId.toString());
    const g = groups.find((item) => item.id.toString() === groupId.toString());
    if (g && g.poolFormat === 'MATCH_DAY') {
      navigate('/jornadas');
    } else {
      navigate('/');
    }
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
    selectedTemplate,
    selectTemplate,
    wizardStep,
    setWizardStep,
    newlyCreatedGroup,
    setNewlyCreatedGroup,
    pendingJoinCodeNotice,
    joinCode,
    setJoinCode,
    visibleCodes,
    toggleCodeVisibility,
    isCreating,
    handleCreate,
    handleJoin,
    handleEditGroup,
    handleDeleteGroup,
    handleEnterGroup,
    handleLeaveGroup,
    handleCopyCode,
    handleCopyLink,
    handleShareWhatsApp,
    userName,
    userId,
    activeGroupId,
    navigate,
  };
}
