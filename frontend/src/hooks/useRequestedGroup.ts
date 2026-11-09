import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { useAppContext } from '../context/AppContext';

/**
 * Abre la liga de `?group=ID` (p. ej. desde un aviso) si el usuario es miembro.
 * Devuelve `true` mientras la petición está pendiente, para no pintar (ni redirigir desde)
 * la liga que estaba activa antes de cambiar.
 */
export function useRequestedGroup({
  userGroups,
  userGroupsLoaded,
  activeGroupId,
  changeGroup,
}: Pick<
  ReturnType<typeof useAppContext>,
  'userGroups' | 'userGroupsLoaded' | 'activeGroupId' | 'changeGroup'
>) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('group');
  useEffect(() => {
    // Hasta que llegan las ligas, `userGroups` es una lista vacía: esperar o se descartaría la petición.
    if (!requested || !userGroupsLoaded) return;
    const group = userGroups.find((candidate) => String(candidate.id) === requested);
    if (group && String(activeGroupId) !== requested) changeGroup(group.id);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('group');
        return next;
      },
      { replace: true },
    );
  }, [requested, userGroups, userGroupsLoaded, activeGroupId, changeGroup, setParams]);
  return Boolean(requested);
}
