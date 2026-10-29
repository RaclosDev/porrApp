/** Opciones de consulta compartidas por varios componentes (misma clave, misma función). */
import { queryOptions } from '@tanstack/react-query';
import { fetchMyGroups } from './api';
import { queryKeys } from './queryKeys';

export const myGroupsQuery = (isAuthenticated: boolean) =>
  queryOptions({
    queryKey: queryKeys.myGroups(isAuthenticated),
    queryFn: () => (isAuthenticated ? fetchMyGroups() : Promise.resolve([])),
    staleTime: 60_000,
  });
