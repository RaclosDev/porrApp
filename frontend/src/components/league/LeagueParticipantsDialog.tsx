import { useQuery } from '@tanstack/react-query';
import { fetchGroupMembers } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import PeopleListDialog, { type PersonItem } from '../PeopleListDialog';

/**
 * Los participantes de una liga, con su foto y nombre. Usa la misma lista de miembros que la
 * gestión de la liga, que en las privadas solo ven sus miembros, sin pagos ni acciones de admin.
 */
export default function LeagueParticipantsDialog({
  groupId,
  groupName,
  onClose,
}: {
  groupId: string | number;
  groupName: string;
  onClose: () => void;
}) {
  const {
    data: members,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.groupMembers(groupId),
    queryFn: () => fetchGroupMembers(groupId),
    enabled: Boolean(groupId),
  });

  const people: PersonItem[] = (members ?? [])
    .map((member) => ({
      userId: member.userId,
      name: member.participantName,
      avatarUrl: member.avatarUrl,
      badge: member.isAdmin ? 'Admin' : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  const status = isLoading
    ? 'Cargando participantes…'
    : error
      ? 'No se ha podido cargar la lista de participantes.'
      : people.length === 0
        ? 'Todavía no hay participantes.'
        : undefined;

  return (
    <PeopleListDialog
      title="Participantes"
      subtitle={groupName}
      intro={
        people.length > 0
          ? `${people.length} ${people.length === 1 ? 'participante' : 'participantes'} en la liga`
          : undefined
      }
      people={people}
      status={status}
      onClose={onClose}
    />
  );
}
