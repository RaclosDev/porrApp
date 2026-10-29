import toast from 'react-hot-toast';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { Competition, Group, PoolFormat } from '../types/api';

type GroupId = number | string;
import { errorMessage } from '../utils/errors';

export const POOL_FORMATS: { id: PoolFormat; label: string }[] = [
  { id: 'MATCH_DAY', label: 'Por Jornadas (1X2 y Marcador Exacto)' },
  { id: 'FULL_BRACKET', label: 'Completa (Fase de grupos y cruces)' },
  { id: 'KNOCKOUTS_ONLY', label: 'Bracket (Solo Cuadro Final)' },
];

export function useGroupsDashboard() {
  const queryClient = useQueryClient();
  const { changeGroup, userName, userId, activeGroupId, userGroups, isAuthenticated } =
    useAppContext();
  const [groups, setGroups] = useState<Group[]>(
    userGroups && userGroups.length > 0 ? userGroups : [],
  );
  // Permite consultar el número de ligas cargadas sin recrear loadGroupsAndCompetitions.
  const groupsRef = useRef(groups);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(!userGroups || userGroups.length === 0);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [selectedPoolFormat, setSelectedPoolFormat] = useState<PoolFormat>('MATCH_DAY');
  const [includePichichi, setIncludePichichi] = useState(false);
  const [newlyCreatedGroup, setNewlyCreatedGroup] = useState<Group | null>(null);
  const [pendingJoinCodeNotice, setPendingJoinCodeNotice] = useState('');
  const [pendingInvite, setPendingInvite] = useState<Group | null>(null);
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [visibleCodes, setVisibleCodes] = useState(new Set<GroupId>());
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
    setLoading((prev) => (groupsRef.current.length > 0 ? false : prev));
    setError('');
    try {
      const [myGroups, comps] = await Promise.all([
        fetchMyGroups().catch((err): Group[] => {
          console.warn('No se pudieron obtener las ligas del usuario', err);
          return [];
        }),
        fetchCompetitions().catch((): Competition[] => []),
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
          const invalidIds: string[] = [];
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
              const pruned = current.filter((x: GroupId) => !invalidIds.includes(x.toString()));
              localStorage.setItem('knownGroups', JSON.stringify(pruned));
            } catch {
              /* ignore */
            }
          }
          const validExtras = extraGroups.filter((g): g is Group => g != null);
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
      .then((preview) => {
        if (!cancelled) setPendingInvite(preview);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, 'No se ha encontrado esta invitación'));
      });
    return () => {
      cancelled = true;
    };
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
      // El alta afecta a la tarjeta, al listado de miembros y al ranking de esta liga.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myGroups'] }),
        queryClient.invalidateQueries({ queryKey: ['group', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard', groupId] }),
      ]);
      localStorage.removeItem('pendingJoinCode');
      setPendingJoinCodeNotice('');
      setPendingInvite(null);
      changeGroup(groupId);
      toast.success(`¡Te has unido a "${fullGroup.name || group.name}"!`);
      navigate('/', { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'No se ha podido aceptar la invitación'));
    } finally {
      setIsJoiningInvite(false);
    }
  };

  const handleCreate = async (e?: { preventDefault?: () => void }) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isCreating) return;
    if (!newGroupName.trim() || !selectedCompetition || !selectedPoolFormat) {
      setError('El nombre del grupo y la competición son obligatorios');
      return;
    }
    setIsCreating(true);
    try {
      const group = await createGroup(
        newGroupName.trim(),
        selectedCompetition,
        selectedPoolFormat,
        includePichichi,
      );
      setNewGroupName('');
      setNewlyCreatedGroup(group);
      changeGroup(group.id.toString());
      loadGroupsAndCompetitions();
    } catch (e) {
      setError(errorMessage(e, 'Error al crear el grupo'));
    } finally {
      setIsCreating(false);
    }
  };

  // Compartir solo el enlace: WhatsApp genera la vista previa con los metadatos OG,
  // exactamente igual que al pegar la URL a mano.
  const handleShareWhatsApp = (group: Pick<Group, 'joinCode'> | null | undefined) => {
    if (!group?.joinCode) return;

    const link = `https://porra.raclos.es/join/${encodeURIComponent(group.joinCode)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank', 'noopener,noreferrer');
  };

  /** Guarda nombre y reglas en una sola petición para evitar estados parciales. */
  const handleSaveGroupConfig = async (groupId: GroupId, name: string, rules: string) => {
    try {
      await updateGroup(groupId, name?.trim(), rules);
      loadGroupsAndCompetitions();
      return true;
    } catch (e) {
      setError(errorMessage(e, 'Ha ocurrido un error'));
      return false;
    }
  };

  /** Sube la imagen de la liga. Devuelve la nueva URL; lanza Error con mensaje si falla. */
  const handleUploadGroupImage = async (groupId: GroupId, blob: Blob) => {
    const res = await uploadGroupImage(groupId, blob);
    await loadGroupsAndCompetitions();
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
    toast.success('Imagen de la liga actualizada');
    return res.imageUrl || null;
  };

  const handleRemoveGroupImage = async (groupId: GroupId) => {
    await deleteGroupImage(groupId);
    await loadGroupsAndCompetitions();
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
    toast.success('Imagen de la liga eliminada');
  };

  /**
   * Elimina una liga. `skipConfirm` se usa cuando la confirmación ya se pidió
   * dentro de la interfaz (por ejemplo, escribiendo el nombre de la liga).
   */
  const handleDeleteGroup = async (
    groupId: GroupId,
    groupName: string,
    { skipConfirm = false } = {},
  ) => {
    if (
      !skipConfirm &&
      !window.confirm(
        `⚠️ ADVERTENCIA ⚠️\n¿Estás seguro de que quieres BORRAR POR COMPLETO la liga "${groupName}"?\n\nEsta acción eliminará todos los pronósticos de todos los participantes y no se puede deshacer.`,
      )
    )
      return false;

    try {
      await deleteGroup(groupId);
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const updatedKnownGroups = knownGroups.filter(
        (id: GroupId) => id.toString() !== groupId.toString(),
      );
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));

      if (activeGroupId === groupId.toString()) {
        changeGroup(null);
      }

      loadGroupsAndCompetitions();
      toast.success(`La liga "${groupName}" ha sido eliminada.`);
      return true;
    } catch (e) {
      setError(errorMessage(e, 'Ha ocurrido un error'));
      return false;
    }
  };

  const handleJoin = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
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
      // El alta afecta a la tarjeta, al listado de miembros y al ranking de esta liga.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myGroups'] }),
        queryClient.invalidateQueries({ queryKey: ['group', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard', groupId] }),
      ]);
      setJoinCode('');
      changeGroup(groupId);
      await loadGroupsAndCompetitions();
      toast.success(`¡Te has unido a "${fullGroup.name || group.name}"!`);
      // La portada adapta automáticamente el contenido al formato de esta liga.
      navigate('/', { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'Ha ocurrido un error'));
    }
  };

  const handleEnterGroup = (groupId: GroupId) => {
    changeGroup(groupId.toString());
    const g = groups.find((item) => item.id.toString() === groupId.toString());
    if (g && g.poolFormat === 'MATCH_DAY') {
      navigate('/jornadas');
    } else {
      navigate('/');
    }
  };

  const handleLeaveGroup = async (groupId: GroupId, groupName: string) => {
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
      const updatedKnownGroups = knownGroups.filter(
        (id: GroupId) => id.toString() !== groupId.toString(),
      );
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));

      loadGroupsAndCompetitions();
      toast.success(`Has abandonado la liga "${groupName}".`);
    } catch (e) {
      setError(errorMessage(e, 'Ha ocurrido un error'));
    }
  };

  const toggleCodeVisibility = (groupId: GroupId) => {
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

  const handleCopyCode = (code: string | null) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Código "${code}" copiado al portapapeles`);
  };

  const handleCopyLink = (code: string | null) => {
    if (!code) return;
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
    selectedPoolFormat,
    setSelectedPoolFormat,
    includePichichi,
    setIncludePichichi,
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
    handleSaveGroupConfig,
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

export type GroupsDashboardState = ReturnType<typeof useGroupsDashboard>;
