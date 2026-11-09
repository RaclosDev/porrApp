import toast from 'react-hot-toast';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  joinGroup,
  fetchGroup,
  leaveGroup,
  updateGroup,
  deleteGroup,
  repeatGroup,
  uploadGroupImage,
  deleteGroupImage,
} from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { myGroupsQuery, myLeagueSummariesQuery } from '../services/queries';
import type { Group, LeagueSummary } from '../types/api';
import { errorMessage } from '../utils/errors';
import { isApiError } from '../services/apiError';
import { useAppStore } from '../store/useAppStore';
import { dropFromMyGroups, forgetLeague } from '../context/leagueFallback';
import { confirmAction } from '../utils/confirmAction';
import { isMatchBasedFormat } from '../utils/poolFormat';
import { copyWithToast, joinLink, shareJoinLinkOnWhatsApp } from '../utils/leagueInvite';

type GroupId = number | string;

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
  const { data: summaryList } = useQuery(myLeagueSummariesQuery(isAuthenticated));
  const summaries = useMemo(
    () => new Map<number, LeagueSummary>((summaryList ?? []).map((s) => [s.groupId, s])),
    [summaryList],
  );
  const [extraGroups, setExtraGroups] = useState<Group[]>([]);
  const groups = useMemo(() => [...(myGroups ?? []), ...extraGroups], [myGroups, extraGroups]);
  const loading = Boolean(userName) && myGroupsPending;
  const groupsError = myGroupsFailed
    ? errorMessage(myGroupsError, 'No se han podido cargar tus ligas.')
    : '';

  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [visibleCodes, setVisibleCodes] = useState(new Set<GroupId>());

  const navigate = useNavigate();

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
        fetchGroup(id).catch((error: unknown) => {
          if (isApiError(error, 404) || isApiError(error, 410)) invalidIds.push(id);
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

  const handleShareWhatsApp = (group: Pick<Group, 'joinCode'> | null | undefined) => {
    if (group?.joinCode) shareJoinLinkOnWhatsApp(group.joinCode);
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
      !(await confirmAction({
        title: `¿Eliminar «${groupName}»?`,
        message: 'Se borrarán todas sus predicciones y no se puede deshacer.',
        confirmLabel: 'Eliminar liga',
      }))
    )
      return false;

    try {
      await deleteGroup(groupId);
      forgetKnownGroups([groupId]);
      // Fuera de la lista ya: si era la activa, se abre sola la más reciente (useLeagueDataEffects).
      dropFromMyGroups(queryClient, groupId);
      if (useAppStore.getState().activeGroupId !== groupId.toString())
        forgetLeague(queryClient, groupId);

      refreshGroups();
      toast.success(`La liga "${groupName}" ha sido eliminada.`);
      return true;
    } catch (e) {
      setError(errorMessage(e, 'No se pudo eliminar la liga'));
      return false;
    }
  };

  /** Crea la liga de la temporada nueva con los mismos miembros y ajustes, y la deja como activa. */
  const handleRepeatGroup = async (group: Group) => {
    if (
      !(await confirmAction({
        title: `¿Repetir «${group.name}»?`,
        message: `Se creará otra liga para la temporada ${group.nextSeason ?? 'nueva'} con los mismos miembros y ajustes. Los puntos empiezan de cero y esta se queda con su clasificación final.`,
        confirmLabel: 'Repetir liga',
      }))
    )
      return;
    try {
      const repeated = await repeatGroup(group.id);
      rememberKnownGroup(repeated.id);
      const groupId = repeated.id.toString();
      queryClient.setQueryData(queryKeys.group(groupId), repeated);
      await refreshGroups();
      changeGroup(groupId);
      toast.success(
        `«${repeated.name}» ya tiene su liga de la temporada ${repeated.season ?? 'nueva'}.`,
      );
    } catch (e) {
      setError(errorMessage(e, 'No se pudo repetir la liga'));
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
      setError('');
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
    if (g && isMatchBasedFormat(g.poolFormat)) {
      navigate('/jornadas');
    } else {
      navigate('/');
    }
  };

  const handleLeaveGroup = async (groupId: GroupId, groupName: string) => {
    if (
      !(await confirmAction({
        title: `¿Salir de «${groupName}»?`,
        message: 'Perderás tus porras en esta liga.',
        confirmLabel: 'Salir de la liga',
      }))
    )
      return;
    try {
      await leaveGroup(groupId);
      forgetKnownGroups([groupId]);
      // Fuera de la lista ya: si era la activa, se abre sola la más reciente (useLeagueDataEffects).
      dropFromMyGroups(queryClient, groupId);
      if (useAppStore.getState().activeGroupId !== groupId.toString())
        forgetLeague(queryClient, groupId);

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
    if (code) void copyWithToast(code, `Código "${code}" copiado al portapapeles`);
  };

  const handleCopyLink = (code: string | null) => {
    if (code) void copyWithToast(joinLink(code), 'Enlace de invitación copiado al portapapeles');
  };

  return {
    summaries,
    groups,
    loading,
    error,
    groupsError,
    retryGroups,
    joinCode,
    setJoinCode,
    visibleCodes,
    toggleCodeVisibility,
    handleJoin,
    handleSaveGroupConfig,
    handleUploadGroupImage,
    handleRemoveGroupImage,
    handleDeleteGroup,
    handleRepeatGroup,
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
