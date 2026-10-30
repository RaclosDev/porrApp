import toast from 'react-hot-toast';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { myGroupsQuery } from '../services/queries';
import type { Competition, Group, PoolFormat } from '../types/api';
import { errorMessage } from '../utils/errors';

type GroupId = number | string;

export const POOL_FORMATS: { id: PoolFormat; label: string }[] = [
  { id: 'MATCH_DAY', label: 'Por jornadas (1X2 y marcador exacto)' },
  { id: 'FULL_BRACKET', label: 'Completa (fase de grupos y cruces)' },
  { id: 'KNOCKOUTS_ONLY', label: 'Solo eliminatorias' },
];

const KNOWN_GROUPS_KEY = 'knownGroups';

/** Ligas abiertas en este dispositivo sin sesión. Un valor corrupto cuenta como lista vacía. */
export const readKnownGroups = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KNOWN_GROUPS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeKnownGroups = (ids: string[]) => {
  try {
    localStorage.setItem(KNOWN_GROUPS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
};

const rememberKnownGroup = (groupId: GroupId) => {
  const ids = readKnownGroups();
  if (!ids.includes(groupId.toString())) writeKnownGroups([...ids, groupId.toString()]);
};

const forgetKnownGroups = (groupIds: GroupId[]) => {
  const drop = groupIds.map(String);
  writeKnownGroups(readKnownGroups().filter((id) => !drop.includes(id)));
};

export function useGroupsDashboard() {
  const queryClient = useQueryClient();
  const { changeGroup, userName, userId, activeGroupId, isAuthenticated } = useAppContext();

  // La lista sale directamente de la consulta compartida: si falla, se muestra el error y la
  // caché no se toca (antes se guardaba [] y la app creía que el usuario no tenía ligas).
  const {
    data: myGroups,
    isPending: myGroupsPending,
    isError: myGroupsFailed,
    error: myGroupsError,
    refetch: refetchMyGroups,
  } = useQuery(myGroupsQuery(isAuthenticated));
  const [extraGroups, setExtraGroups] = useState<Group[]>([]);
  const groups = useMemo(() => [...(myGroups ?? []), ...extraGroups], [myGroups, extraGroups]);
  const loading = Boolean(userName) && myGroupsPending;
  const groupsError = myGroupsFailed
    ? errorMessage(myGroupsError, 'No se han podido cargar tus ligas.')
    : '';

  const [competitions, setCompetitions] = useState<Competition[]>([]);
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
    let cancelled = false;
    fetchCompetitions()
      .catch((): Competition[] => [])
      .then((comps) => {
        if (cancelled) return;
        setCompetitions(comps);
        if (comps.length > 0) {
          setSelectedCompetition((prev) => (prev ? prev : comps[0].id.toString()));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sin sesión, las ligas conocidas en este dispositivo se piden una a una (máximo 3).
  useEffect(() => {
    if (isAuthenticated || !userName || !myGroups) return;
    const missingIds = readKnownGroups()
      .filter((id) => !myGroups.some((g) => g.id.toString() === id))
      .slice(0, 3);
    if (missingIds.length === 0) return;
    let cancelled = false;
    const invalidIds: string[] = [];
    Promise.all(
      missingIds.map((id) =>
        fetchGroup(id).catch(() => {
          invalidIds.push(id);
          return null;
        }),
      ),
    ).then((extra) => {
      if (cancelled) return;
      if (invalidIds.length > 0) forgetKnownGroups(invalidIds);
      setExtraGroups(extra.filter((g): g is Group => g != null));
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userName, myGroups]);

  // Con una sola liga, esa es la activa.
  useEffect(() => {
    if (groups.length !== 1) return;
    const onlyGroupId = groups[0].id.toString();
    if (activeGroupId !== onlyGroupId) changeGroup(onlyGroupId);
  }, [groups, activeGroupId, changeGroup]);

  /** Vuelve a pedir la lista de ligas y los detalles de cada una tras un cambio. */
  const refreshGroups = useCallback(async () => {
    setError('');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.group() }),
    ]);
  }, [queryClient]);

  const retryGroups = useCallback(() => {
    refetchMyGroups();
  }, [refetchMyGroups]);

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

  const handleAcceptPendingInvite = async () => {
    const code = pendingJoinCodeNotice || localStorage.getItem('pendingJoinCode');
    if (!code || isJoiningInvite) return;
    setIsJoiningInvite(true);
    setError('');
    try {
      const group = await joinGroup(code);
      rememberKnownGroup(group.id);
      const groupId = group.id.toString();
      const fullGroup = await fetchGroup(groupId).catch(() => group);
      queryClient.setQueryData(queryKeys.group(groupId), fullGroup);
      // El alta afecta a la tarjeta, al listado de miembros y al ranking de esta liga.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(groupId) }),
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
      setError('El nombre de la liga y la competición son obligatorios');
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
      refreshGroups();
    } catch (e) {
      setError(errorMessage(e, 'No se pudo crear la liga'));
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
      refreshGroups();
      return true;
    } catch (e) {
      setError(errorMessage(e, 'No se pudieron guardar los cambios'));
      return false;
    }
  };

  /** Sube la imagen de la liga. Devuelve la nueva URL; lanza Error con mensaje si falla. */
  const handleUploadGroupImage = async (groupId: GroupId, blob: Blob) => {
    const res = await uploadGroupImage(groupId, blob);
    await refreshGroups();
    toast.success('Imagen de la liga actualizada');
    return res.imageUrl || null;
  };

  const handleRemoveGroupImage = async (groupId: GroupId) => {
    await deleteGroupImage(groupId);
    await refreshGroups();
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
        `¿Eliminar la liga "${groupName}"? Se borrarán todos sus pronósticos y no se puede deshacer.`,
      )
    )
      return false;

    try {
      await deleteGroup(groupId);
      forgetKnownGroups([groupId]);

      if (activeGroupId === groupId.toString()) {
        changeGroup(null);
      }

      refreshGroups();
      toast.success(`La liga "${groupName}" ha sido eliminada.`);
      return true;
    } catch (e) {
      setError(errorMessage(e, 'No se pudo eliminar la liga'));
      return false;
    }
  };

  const handleJoin = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!joinCode.trim()) return;
    try {
      const group = await joinGroup(joinCode);

      rememberKnownGroup(group.id);

      const groupId = group.id.toString();
      const fullGroup = await fetchGroup(groupId).catch(() => group);
      queryClient.setQueryData(queryKeys.group(groupId), fullGroup);
      // El alta afecta a la tarjeta, al listado de miembros y al ranking de esta liga.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(groupId) }),
      ]);
      setJoinCode('');
      changeGroup(groupId);
      await refreshGroups();
      toast.success(`¡Te has unido a "${fullGroup.name || group.name}"!`);
      // La portada adapta automáticamente el contenido al formato de esta liga.
      navigate('/', { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'No se pudo unir a la liga'));
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
      forgetKnownGroups([groupId]);

      refreshGroups();
      toast.success(`Has abandonado la liga "${groupName}".`);
    } catch (e) {
      setError(errorMessage(e, 'No se pudo salir de la liga'));
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
    groupsError,
    retryGroups,
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
