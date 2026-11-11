import { useState, type FormEvent } from 'react';
import { GAME_TEMPLATES } from './gameTemplates';
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
    : game.mode === 'WINS' || game.mode === 'ROUNDS'
      ? `${game.mode === 'ROUNDS' ? 'Puntos por ronda' : 'Victorias por ronda'}${game.targetWins ? ` · primero en ganar ${game.targetWins}` : ''}`
      : `Por ${game.unit}${game.lowerWins ? ', gana quien menos suma' : ''}`;

/** Elegir a qué se juega: uno de los juegos de la liga o uno nuevo, que empieza en cuanto se crea. */
export default function TrackerGamePicker({ games, busy, onPick, onCreate }: Props) {
  const [creating, setCreating] = useState(games.length === 0);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TrackerGameMode>('POINTS');
  const [unit, setUnit] = useState('puntos');
  const [lowerWins, setLowerWins] = useState(false);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const hasPoints = mode === 'POINTS' || mode === 'ROUNDS';
  const hasRounds = mode === 'WINS' || mode === 'ROUNDS';

  const applyTemplate = (template: TrackerGameDraft) => {
    setName(template.name);
    setMode(template.mode);
    setUnit(template.unit);
    setLowerWins(template.lowerWins);
    setTarget('');
    setError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    const targetWins = hasRounds && target.trim() ? Number(target) : null;
    if (
      targetWins !== null &&
      (!Number.isInteger(targetWins) || targetWins < 1 || targetWins > 500)
    ) {
      setError('El objetivo debe ser de 1 a 500 rondas ganadas.');
      return;
    }
    setError('');
    const created = await onCreate({
      name: name.trim(),
      mode,
      unit: hasPoints ? unit.trim() || 'puntos' : 'victorias',
      lowerWins: hasPoints && lowerWins,
      ...(targetWins !== null ? { targetWins } : {}),
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
          <fieldset className="tracker-fieldset" disabled={busy}>
            <legend>Preparar a partir de un juego (opcional)</legend>
            <div className="tracker-unit-options">
              {GAME_TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  className="glass-btn create-league-small-btn"
                  onClick={() => applyTemplate(template)}
                >
                  {template.name}
                </button>
              ))}
            </div>
            <p className="tracker-note">
              Son puntos de partida. Puedes cambiar el nombre y las reglas de abajo.
            </p>
          </fieldset>
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
                  ['POINTS', 'Sumar puntos'],
                  ['ROUNDS', 'Puntos por ronda'],
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
          {hasPoints ? (
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
                {mode === 'ROUNDS'
                  ? 'Gana la ronda quien menos puntos tiene'
                  : 'Gana quien menos suma'}
              </label>
            </>
          ) : (
            <p className="tracker-note">
              {mode === 'DIRECT'
                ? 'Se marca quién gana y la partida termina al guardarlo.'
                : 'En cada ronda se toca a quien la gana, sin tener que apuntar puntos.'}
            </p>
          )}
          {mode === 'ROUNDS' && (
            <p className="tracker-note">
              Apunta los puntos de cada ronda. Gana la partida quien gane más rondas; los puntos
              quedan guardados.
            </p>
          )}
          {hasRounds && (
            <div className="create-league-field">
              <label htmlFor="tracker-game-target">Rondas que hay que ganar (opcional)</label>
              <input
                id="tracker-game-target"
                className="glass-input"
                type="number"
                min={1}
                max={500}
                inputMode="numeric"
                placeholder="Por ejemplo: 5"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
              <p className="tracker-note">
                Con objetivo, la partida termina al alcanzarlo. Si hay empate en una ronda, cuenta
                para quienes empaten. Sin objetivo, la terminas cuando acabéis.
              </p>
            </div>
          )}
          {error && (
            <p className="create-league-error is-block" role="alert">
              {error}
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
