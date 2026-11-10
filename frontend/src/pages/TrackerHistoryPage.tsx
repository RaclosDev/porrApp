import PaperLoading from '../components/PaperLoading';
import TrackerHistory from '../components/tracker/TrackerHistory';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import { useTrackerLeague } from '../hooks/useTrackerLeague';

/** Histórico de una liga de juegos de mesa: cada día, quién vino y la hoja de cada partida. */
export default function TrackerHistoryPage({ leagueId }: { leagueId: string | null }) {
  const { query, tracker } = useTrackerLeague(leagueId);
  if (query.isPending) return <PaperLoading label="Cargando el histórico" />;
  if (!tracker) return <TrackerUnavailable error={query.error} />;
  return (
    <section className="view-section active create-league tracker">
      <header className="create-league-header tracker-head">
        <div>
          <h1 className="m-0 poster-title text-[1.8rem] text-white">Histórico</h1>
          <p className="create-league-progress">{tracker.name}</p>
        </div>
      </header>
      <section
        className="paper-panel album-sheet tracker-section"
        aria-labelledby="tracker-history-title"
      >
        <h2 id="tracker-history-title" className="tracker-heading">
          Días de juego
        </h2>
        <TrackerHistory tracker={tracker} />
      </section>
    </section>
  );
}
