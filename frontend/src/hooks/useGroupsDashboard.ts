import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import {
  fetchMyGroups,
  createGroup,
  joinGroup,
  fetchGroup,
  fetchGroupInvitationPreview,
  leaveGroup,
  fetchCompetitions,
  updateGroup,
  deleteGroup,
  uploadGroupImage,
  deleteGroupImage,
} from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const { changeGroup, userName, userId, activeGroupId, userGroups, isAuthenticated } =
    useAppContext();
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
  const [pendingInvite, setPendingInvite] = useState(null);
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [visibleCodes, setVisibleCodes] = useState(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (userGroups) {
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
      const missingIds =
        !isAuthenticated && Array.isArray(knownIds)
          ? knownIds
              .filter((id) => !myGroups.find((g) => g.id.toString() === id.toString()))
              .slice(0, 3)
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
      queryClient.setQueryData(['myGroups', isAuthenticated], myGroups);
      queryClient.invalidateQueries({ queryKey: ['group'] });
    } catch (e) {
      console.error(e);
      setError('Error al cargar datos');
    }
    setLoading(false);
  }, [changeGroup, isAuthenticated, queryClient]);

  useEffect(() => {
    const pendingCode = localStorage.getItem('pendingJoinCode');
    if (!pendingCode) return;
    const normalizedCode = pendingCode.trim().toUpperCase();
    setPendingJoinCodeNotice(normalizedCode);
    let cancelled = false;
    fetchGroupInvitationPreview(normalizedCode)
      .then((preview) => { if (!cancelled) setPendingInvite(preview); })
      .catch((e) => { if (!cancelled) setError(e.message || 'No se ha encontrado esta invitación'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (userName && !pendingJoinCodeNotice) {
      loadGroupsAndCompetitions();
    } else if (!userName) {
      setTimeout(() => setLoading(false), 0);
    }
  }, [userName, pendingJoinCodeNotice, loadGroupsAndCompetitions]);

  const handleAcceptPendingInvite = async () => {
    const code = pendingJoinCodeNotice || localStorage.getItem('pendingJoinCode');
    if (!code || isJoiningInvite) return;
    setIsJoiningInvite(true);
    setError('');
    try {
      const group = await joinGroup(code);
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      if (!knownGroups.includes(group.id.toString())) {
        knownGroups.push(group.id.toString());
        localStorage.setItem('knownGroups', JSON.stringify(knownGroups));
      }
      const groupId = group.id.toString();
      const fullGroup = await fetchGroup(groupId).catch(() => group);
      queryClient.setQueryData(['group', groupId], fullGroup);
      await queryClient.invalidateQueries({ queryKey: ['myGroups'] });
      localStorage.removeItem('pendingJoinCode');
      setPendingJoinCodeNotice('');
      setPendingInvite(null);
      changeGroup(groupId);
      toast.success(`¡Te has unido a "${fullGroup.name || group.name}"!`);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.message || 'No se ha podido aceptar la invitación');
    } finally {
      setIsJoiningInvite(false);
    }
  };

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
    if (!group?.joinCode) return;

    // WhatsApp obtiene la imagen de la invitación desde los metadatos Open Graph
    // de /join/{code}; no se adjunta ni se descarga un archivo desde el navegador.
    const text = `Únete: https://porra.raclos.es/join/${encodeURIComponent(group.joinCode)}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEditGroup = async (groupId, currentName, explicitName) => {
    const newName = explicitName ?? prompt('Introduce el nuevo nombre para la liga:', currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return false;

    try {
      await updateGroup(groupId, newName.trim(), undefined);
      loadGroupsAndCompetitions();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const handleUpdateRules = async (groupId, rules) => {
    try {
      await updateGroup(groupId, undefined, rules);
      loadGroupsAndCompetitions();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  /** Sube la imagen de la liga. Devuelve la nueva URL; lanza Error con mensaje si falla. */
  const handleUploadGroupImage = async (groupId, blob) => {
    const res = await uploadGroupImage(groupId, blob);
    await loadGroupsAndCompetitions();
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
    toast.success('Imagen de la liga actualizada');
    return res.imageUrl || null;
  };

  const handleRemoveGroupImage = async (groupId) => {
    await deleteGroupImage(groupId);
    await loadGroupsAndCompetitions();
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
    toast.success('Imagen de la liga eliminada');
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (
      !window.confirm(
        `⚠️ ADVERTENCIA ⚠️\n¿Estás seguro de que quieres BORRAR POR COMPLETO la liga "${groupName}"?\n\nEsta acción eliminará todos los pronósticos de todos los participantes y no se puede deshacer.`,
      )
    )
      return false;

    try {
      await deleteGroup(groupId);
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const updatedKnownGroups = knownGroups.filter((id) => id.toString() !== groupId.toString());
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));

      if (activeGroupId === groupId.toString()) {
        changeGroup(null);
      }

      loadGroupsAndCompetitions();
      toast.success(`La liga "${groupName}" ha sido eliminada.`);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
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

      const groupId = group.id.toString();
      const fullGroup = await fetchGroup(groupId).catch(() => group);
      queryClient.setQueryData(['group', groupId], fullGroup);
      await queryClient.invalidateQueries({ queryKey: ['myGroups'] });
      setJoinCode('');
      changeGroup(groupId);
      await loadGroupsAndCompetitions();
      toast.success(`¡Te has unido a "${fullGroup.name || group.name}"!`);
      // La portada adapta automáticamente el contenido al formato de esta liga.
      navigate('/', { replace: true });
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
      if (activeGroupId === groupId.toString()) changeGroup(null);
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const updatedKnownGroups = knownGroups.filter((id) => id.toString() !== groupId.toString());
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));

      loadGroupsAndCompetitions();
      toast.success(`Has abandonado la liga "${groupName}".`);
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
    toast.success(`Código "${code}" copiado al portapapeles`);
  };

  const handleCopyLink = (code) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Enlace de invitación copiado al portapapeles');
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
    pendingInvite,
    handleAcceptPendingInvite,
    isJoiningInvite,
    joinCode,
    setJoinCode,
    visibleCodes,
    toggleCodeVisibility,
    isCreating,
    handleCreate,
    handleJoin,
    handleEditGroup,
    handleUpdateRules,
    handleUploadGroupImage,
    handleRemoveGroupImage,
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
