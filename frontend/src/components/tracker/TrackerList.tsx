import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTrackers } from '../../services/endpoints/trackers';
import { queryKeys } from '../../services/queryKeys';

/** Marcadores de juegos del usuario en «Mis ligas»; sin ninguno, solo el acceso para crear uno. */
export default function TrackerList() {
  const trackers = useQuery({ queryKey: queryKeys.trackers(), queryFn: fetchTrackers });
  const list = trackers.data ?? [];

  return (
    <section className="tracker-list" aria-labelledby="tracker-list-title">
      <div className="tracker-list-head">
        <h3 id="tracker-list-title" className="poster-title m-0 text-[1.3rem]">
          Marcadores de juegos
        </h3>
        <Link to="/marcador/nuevo" className="glass-btn create-league-small-btn">
          Crear marcador
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="text-muted text-[0.9rem] m-0">
          Para juegos de mesa o de cartas: apunta las partidas con tus amigos y llevad el ranking,
          en directo y con histórico.
        </p>
      ) : (
        <ul className="tracker-list-items">
          {list.map((tracker) => (
            <li key={tracker.id}>
              <Link to={`/marcador/${tracker.id}`} className="tracker-card paper-panel album-sheet">
                <strong>{tracker.name}</strong>
                <span>
                  {tracker.players} jugadores · {tracker.rounds} partidas
                  {tracker.owner ? ' · tuyo' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
