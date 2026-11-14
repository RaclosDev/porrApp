import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  addMusicTrack,
  fetchMusicQueue,
  removeMusicTrack,
  type MusicQueue,
  type MusicTrack,
} from '../../services/endpoints/pokerMusic';
import { queryKeys } from '../../services/queryKeys';
import { errorMessage } from '../../utils/errors';

/** Cola de canciones del torneo: se refresca sola cada pocos segundos para que todas las pantallas coincidan. */
export function usePokerMusic(leagueId: string | number) {
  const client = useQueryClient();
  const key = queryKeys.pokerMusic(leagueId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMusicQueue(leagueId),
    refetchInterval: 4000,
  });
  const onSuccess = (data: MusicQueue) => client.setQueryData(key, data);
  const add = useMutation({
    mutationFn: (track: MusicTrack) => addMusicTrack(leagueId, track),
    onSuccess,
    onError: (reason) => toast.error(errorMessage(reason, 'No se pudo añadir la canción.')),
  });
  const remove = useMutation({
    mutationFn: (itemId: number) => removeMusicTrack(leagueId, itemId),
    onSuccess,
    onError: (reason) => toast.error(errorMessage(reason, 'No se pudo quitar la canción.')),
  });
  return { queue: query.data, add, remove };
}
