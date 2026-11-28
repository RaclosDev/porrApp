import { Link } from 'react-router-dom';
import { ChevronRight, Dices, Spade, Trophy } from 'lucide-react';

/**
 * Primer paso de Crear liga: qué tipo de liga. La porra sigue en este asistente (deporte,
 * competición…); el póker y los juegos de mesa tienen su propia página, así que son enlaces.
 */
export default function LeagueKindPicker({ onPorra }: { onPorra: () => void }) {
  return (
    <div className="paper-panel album-sheet create-league-sheet">
      <h2 className="poster-title create-league-title">¿Qué quieres montar?</h2>
      <ul className="create-league-kinds" aria-label="Tipo de liga">
        <li>
          <button type="button" className="create-league-kind" onClick={onPorra}>
            <Trophy size={26} strokeWidth={2} aria-hidden="true" />
            <span className="create-league-kind-body">
              <strong>Porra</strong>
              <small>Predicciones de fútbol, F1, tenis, UFC y más deportes.</small>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </li>
        <li>
          <Link to="/poker/nueva" className="create-league-kind is-poker">
            <Spade size={26} strokeWidth={2} aria-hidden="true" />
            <span className="create-league-kind-body">
              <strong>Póker</strong>
              <small>Torneos de Texas Hold’em con reloj de ciegas, premios e histórico.</small>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        </li>
        <li>
          <Link to="/marcador/nuevo" className="create-league-kind">
            <Dices size={26} strokeWidth={2} aria-hidden="true" />
            <span className="create-league-kind-body">
              <strong>Juegos de mesa</strong>
              <small>Un marcador para llevar la cuenta de las partidas con tus amigos.</small>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </div>
  );
}
