import { usePokerMusic } from './usePokerMusic';
import YoutubePlayer from './YoutubePlayer';

/**
 * Música del modo TV: la pantalla con el botón «TV» activado reproduce la cola que piden los jugadores. La cola no
 * se enseña en la tele: se ve y se maneja desde el móvil.
 */
export default function PokerTvQueue({ leagueId }: { leagueId: string | number }) {
  const { queue, remove } = usePokerMusic(leagueId);
  const playing = queue?.items[0];
  if (!playing) return null;
  return <YoutubePlayer videoId={playing.videoId} onDone={() => remove.mutate(playing.id)} />;
}
