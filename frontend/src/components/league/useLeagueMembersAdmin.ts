import type { LeagueMemberRole } from '../../services/endpoints/leagues';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  fetchGroupMembers,
  kickGroupMember,
  toggleGroupMemberPayment,
  transferGroupAdmin,
  setGroupMemberRole,
} from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { GroupMember, PaymentStatus } from '../../types/api';
import { errorMessage } from '../../utils/errors';

export type PaymentFilter = 'ALL' | 'PAID' | 'PENDING';

/** Miembros de una liga para su administración: pagos (optimistas), expulsión, permisos y filtros. */
export function useLeagueMembersAdmin(groupId: number, setActionError: (message: string) => void) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [kickTargetId, setKickTargetId] = useState<number | null>(null);

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.groupMembers(groupId),
    queryFn: () => fetchGroupMembers(groupId),
    enabled: Boolean(groupId),
  });

  const paymentRequests = useRef(new Set<number>());
  const [pendingPaymentIds, setPendingPaymentIds] = useState<ReadonlySet<number>>(new Set());

  const paymentMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: PaymentStatus }) =>
      toggleGroupMemberPayment(groupId, userId, status),
    onMutate: async ({ userId, status }) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: queryKeys.groupMembers(groupId) });
      const previous = queryClient
        .getQueryData<GroupMember[]>(queryKeys.groupMembers(groupId))
        ?.find((member) => member.userId === userId)?.paymentStatus;
      queryClient.setQueryData(queryKeys.groupMembers(groupId), (current) =>
        Array.isArray(current)
          ? current.map((member) =>
              String(member.userId) === String(userId)
                ? { ...member, paymentStatus: status }
                : member,
            )
          : current,
      );
      return { previous };
    },
    onError: (err, { userId }, context) => {
      const previous = context?.previous;
      if (previous !== undefined) {
        queryClient.setQueryData<GroupMember[]>(queryKeys.groupMembers(groupId), (current) =>
          current?.map((member) =>
            member.userId === userId ? { ...member, paymentStatus: previous } : member,
          ),
        );
      }
      const message = errorMessage(err, 'No se pudo actualizar el estado de pago.');
      setActionError(message);
      toast.error(message);
    },
    onSuccess: (_data, { status }) => {
      toast.success(
        status === 'PAID' ? 'Pago marcado como recibido' : 'Pago marcado como pendiente',
      );
    },
    onSettled: (_data, _error, { userId }) => {
      paymentRequests.current.delete(userId);
      setPendingPaymentIds(new Set(paymentRequests.current));
      // Wait for the other rows before replacing optimistic values with a server snapshot.
      if (paymentRequests.current.size === 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(groupId) });
      }
    },
  });

  const changePayment = (userId: number, status: PaymentStatus) => {
    if (paymentRequests.current.has(userId)) return;
    paymentRequests.current.add(userId);
    setPendingPaymentIds(new Set(paymentRequests.current));
    paymentMutation.mutate({ userId, status });
  };

  const kickMutation = useMutation({
    mutationFn: (userId: number) => kickGroupMember(groupId, userId),
    onMutate: () => setActionError(''),
    onSuccess: () => {
      setKickTargetId(null);
      toast.success('Miembro expulsado de la liga');
      // El expulsado deja de contar en miembros, ranking, pronósticos y en la tarjeta de la liga.
      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
    },
    onError: (err) => {
      const message = errorMessage(err, 'No se pudo expulsar al miembro.');
      setActionError(message);
      toast.error(message);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: LeagueMemberRole }) =>
      setGroupMemberRole(groupId, userId, role),
    onMutate: () => setActionError(''),
    onSuccess: () => {
      toast.success('Permisos actualizados');

      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.poker(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
    },
    onError: (err) => {
      const message = errorMessage(err, 'No se pudieron actualizar los permisos.');
      setActionError(message);
      toast.error(message);
    },
  });

  const transferMutation = useMutation({
    mutationFn: (userId: number) => transferGroupAdmin(groupId, userId),
    onMutate: () => setActionError(''),
    onSuccess: () => {
      toast.success('Has cedido la liga');
      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
    },
    onError: (err) => {
      const message = errorMessage(err, 'No se pudo ceder la liga.');
      setActionError(message);
      toast.error(message);
    },
  });

  const paidCount = members.filter((member) => member.paymentStatus === 'PAID').length;
  const pendingCount = members.length - paidCount;
  const paidPercent = members.length ? Math.round((paidCount / members.length) * 100) : 0;

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesStatus =
        paymentFilter === 'ALL' ||
        (paymentFilter === 'PAID'
          ? member.paymentStatus === 'PAID'
          : member.paymentStatus !== 'PAID');
      const matchesSearch = !term || (member.participantName || '').toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [members, paymentFilter, search]);

  return {
    members,
    isLoading,
    error,
    pendingPaymentIds,
    changePayment,
    kickMutation,
    kickTargetId,
    setKickTargetId,
    roleMutation,
    transferMutation,
    search,
    setSearch,
    paymentFilter,
    setPaymentFilter,
    visibleMembers,
    paidCount,
    pendingCount,
    paidPercent,
  };
}
