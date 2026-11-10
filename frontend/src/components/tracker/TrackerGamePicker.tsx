import { useState, type FormEvent } from 'react';
import type {
  TrackerGame,
  TrackerGameDraft,
  TrackerGameMode,
} from '../../services/endpoints/trackers';

interface Props {
  games: TrackerGame[];
  busy: boolean;
  onPick: (gameId: number) => void;
  onCreate: (game: TrackerGameDraft) => Promise<boolean>;
}

const describe = (game: TrackerGame) =>
  game.mode === 'DIRECT'
    ? 'Ganador por partida'
    : game.mode === 'WINS'
      ? 'Victorias por ronda'
      : `Por ${game.unit}${game.lowerWins ? ', gana quien menos suma' : ''}`;

/** Elegir a qué se juega: uno de los juegos de la liga o uno nuevo, que empieza en cuanto se crea. */
export default function TrackerGamePicker({ games, busy, onPick, onCreate }: Props) {
  const [creating, setCreating] = useState(games.length === 0);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TrackerGameMode>('POINTS');
  const [unit, setUnit] = useState('puntos');
  const [lowerWins, setLowerWins] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const created = await onCreate({
      name: name.trim(),
      mode,
      unit: mode !== 'POINTS' ? 'victorias' : unit.trim() || 'puntos',
      lowerWins: mode === 'POINTS' && lowerWins,
    });
    if (created) {
      setName('');
      setCreating(false);
    }
  };

  return (
    <div className="tracker-games">
      {games.length > 0 && (
        <ul className="tracker-game-list">
          {games.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                className="glass-btn tracker-game-btn"
                disabled={busy}
                onClick={() => onPick(game.id)}
              >
                <strong>{game.name}</strong>
                <span>{describe(game)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <form className="tracker-new-game" onSubmit={submit} noValidate>
          <div className="create-league-field">
            <label htmlFor="tracker-game-name">Nombre del juego</label>
            <input
              id="tracker-game-name"
              className="glass-input"
              maxLength={60}
              autoComplete="off"
              placeholder="Por ejemplo: Catán"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <fieldset className="tracker-fieldset">
            <legend>¿Cómo se puntúa?</legend>
            <div className="tracker-unit-options">
              {(
                [
                  ['POINTS', 'Por puntos'],
                  ['WINS', 'Victorias por ronda'],
                  ['DIRECT', 'Ganador por partida'],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  className={`glass-btn create-league-small-btn${mode === value ? ' is-active' : ''}`}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {text}
                </button>
              ))}
            </div>
          </fieldset>
          {mode === 'POINTS' ? (
            <>
              <div className="create-league-field">
                <label htmlFor="tracker-game-unit">Se cuentan en</label>
                <input
                  id="tracker-game-unit"
                  className="glass-input"
                  maxLength={30}
                  autoComplete="off"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                />
              </div>
              <label className="tracker-check">
                <input
                  type="checkbox"
                  checked={lowerWins}
                  onChange={(event) => setLowerWins(event.target.checked)}
                />
                Gana quien menos suma
              </label>
            </>
          ) : (
            <p className="tracker-note">
              {mode === 'DIRECT'
                ? 'Se marca quién gana y la partida termina al guardarlo.'
                : 'En cada ronda se toca a quien la gana; la partida se termina al acabar.'}
            </p>
          )}
          <div className="tracker-actions">
            <button
              type="submit"
              className="glass-btn primary-btn tracker-submit"
              disabled={busy || !name.trim()}
            >
              Crear y jugar
            </button>
            {games.length > 0 && (
              <button
                type="button"
                className="create-league-link"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          onClick={() => setCreating(true)}
        >
          Otro juego nuevo
        </button>
      )}
    </div>
  );
}
