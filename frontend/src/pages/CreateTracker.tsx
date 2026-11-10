import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createTracker, type TrackerGameMode } from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import { scoreboardPath } from '../utils/scoreboardLeague';

const UNIT_SUGGESTIONS = ['puntos', 'fichas', 'victorias', 'rondas'];

interface GameTemplate {
  game: string;
  unit: string;
  lowerWins: boolean;
  mode: TrackerGameMode;
}

/** Juegos habituales ya preparados: cómo se cuenta y quién gana. */
const TEMPLATES: GameTemplate[] = [
  { game: 'Mus', unit: 'victorias', lowerWins: false, mode: 'WINS' },
  { game: 'Catán', unit: 'puntos de victoria', lowerWins: false, mode: 'POINTS' },
  { game: 'Chinchón', unit: 'puntos', lowerWins: true, mode: 'POINTS' },
  { game: 'Parchís', unit: 'victorias', lowerWins: false, mode: 'WINS' },
  { game: 'Carcassonne', unit: 'puntos', lowerWins: false, mode: 'POINTS' },
  { game: 'Dominó', unit: 'puntos', lowerWins: false, mode: 'POINTS' },
];

/**
 * Crear un marcador para un juego de mesa o de cartas: solo nombre y qué se cuenta. Los jugadores no se
 * piden aquí: se invita a los amigos al crearlo y cada uno entra solo (o se apunta a mano).
 */
export default function CreateTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('puntos');
  const [lowerWins, setLowerWins] = useState(false);
  const [template, setTemplate] = useState<GameTemplate | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const choose = (option: GameTemplate) => {
    if (template === option) return setTemplate(null);
    setTemplate(option);
    setUnit(option.unit);
    setLowerWins(option.lowerWins);
    if (!name.trim()) setName(option.game);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Ponle nombre al marcador.');
    setError('');
    setBusy(true);
    try {
      const tracker = await createTracker(
        template
          ? { name, unit, lowerWins, gameName: template.game, mode: template.mode }
          : { name, unit, lowerWins },
      );
      // La liga nueva tiene que estar en «Mis ligas» antes de abrirla como activa.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.trackers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
      ]);
      navigate(scoreboardPath(tracker.id), { replace: true });
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo crear el marcador'));
      setBusy(false);
    }
  };

  return (
    <section className="view-section active create-league">
      <header className="create-league-header">
        <h1 className="m-0 poster-title text-[1.8rem] text-white">Marcador de juego</h1>
        <p className="create-league-progress">
          Para juegos de mesa o de cartas: sin predicciones, solo llevar la cuenta.
        </p>
      </header>
      <form
        className="paper-panel album-sheet create-league-sheet"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="create-league-field">
          <label htmlFor="tracker-name">Nombre</label>
          <input
            id="tracker-name"
            className="glass-input"
            maxLength={60}
            autoComplete="off"
            placeholder="Por ejemplo: Mus del viernes"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <fieldset className="create-league-field">
          <legend>¿A qué jugáis? (opcional)</legend>
          <div className="tracker-unit-options">
            {TEMPLATES.map((option) => (
              <button
                key={option.game}
                type="button"
                className={`glass-btn create-league-small-btn${template === option ? ' is-active' : ''}`}
                aria-pressed={template === option}
                onClick={() => choose(option)}
              >
                {option.game}
              </button>
            ))}
          </div>
          {template && (
            <p className="create-league-hint">
              {template.mode === 'WINS'
                ? 'Se apunta quién gana cada partida.'
                : template.lowerWins
                  ? `Se suman ${template.unit} y gana quien menos tiene.`
                  : `Se suman ${template.unit} y gana quien más tiene.`}{' '}
              Luego puedes añadir más juegos.
            </p>
          )}
        </fieldset>

        <div className="create-league-field">
          <label htmlFor="tracker-unit">¿Qué se cuenta en cada partida?</label>
          <div className="tracker-unit-options">
            {UNIT_SUGGESTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`glass-btn create-league-small-btn${unit === option ? ' is-active' : ''}`}
                aria-pressed={unit === option}
                onClick={() => {
                  setUnit(option);
                  setTemplate(null);
                }}
              >
                {option}
              </button>
            ))}
          </div>
          <input
            id="tracker-unit"
            className="glass-input"
            maxLength={20}
            autoComplete="off"
            placeholder="O escribe lo tuyo"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </div>

        <div className="tracker-check">
          <input
            id="tracker-lower"
            type="checkbox"
            checked={lowerWins}
            onChange={(event) => setLowerWins(event.target.checked)}
          />
          <label htmlFor="tracker-lower">Gana quien menos suma (como en el golf)</label>
        </div>

        <p className="create-league-hint">
          Al crearlo te saldrá un QR y un enlace para invitar a tus amigos; cada uno aparecerá como
          jugador al entrar.
        </p>

        {error && (
          <p className="create-league-error is-block" role="alert">
            {error}
          </p>
        )}
        <div className="create-league-nav">
          <Link to="/mis-ligas" className="glass-btn create-league-nav-btn">
            Cancelar
          </Link>
          <button
            type="submit"
            className="glass-btn primary-btn create-league-nav-btn is-primary"
            disabled={busy}
          >
            {busy ? 'Creando…' : 'Crear marcador'}
          </button>
        </div>
      </form>
    </section>
  );
}
