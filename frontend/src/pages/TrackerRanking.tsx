import PaperLoading from '../components/PaperLoading';
import TrackerOverall from '../components/tracker/TrackerOverall';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import { useTrackerLeague } from '../hooks/useTrackerLeague';

/** Ranking de una liga de juegos de mesa: partidas ganadas, por juego y por año. */
export default function TrackerRanking({ leagueId }: { leagueId: string | null }) {
  const { query, tracker } = useTrackerLeague(leagueId);
  if (query.isPending) return <PaperLoading label="Cargando clasificación" />;
  if (!tracker) return <TrackerUnavailable error={query.error} />;
  return (
    <section className="view-section active create-league tracker">
      <header className="create-league-header tracker-head">
        <div>
          <h1 className="m-0 poster-title text-[1.8rem] text-white">Ranking</h1>
          <p className="create-league-progress">{tracker.name}</p>
        </div>
      </header>
      <section
        className="paper-panel album-sheet tracker-section"
        aria-labelledby="tracker-overall-title"
      >
        <h2 id="tracker-overall-title" className="tracker-heading">
          Clasificación general
        </h2>
        <TrackerOverall tracker={tracker} />
      </section>
    </section>
  );
}
