import { Link } from 'react-router-dom';
import { errorMessage } from '../../utils/errors';

/** La liga de juegos de mesa no se ha podido cargar (borrada, sin acceso o sin conexión). */
export default function TrackerUnavailable({ error }: { error: unknown }) {
  return (
    <section className="view-section active create-league">
      <div className="paper-panel album-sheet create-league-sheet">
        <h1 className="poster-title create-league-title">Liga no disponible</h1>
        <p role="alert">{errorMessage(error, 'No se pudo cargar la liga')}</p>
        <Link to="/mis-ligas" className="glass-btn create-league-nav-btn">
          Ir a Mis ligas
        </Link>
      </div>
    </section>
  );
}
