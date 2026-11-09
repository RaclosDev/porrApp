import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createTracker } from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 20;

/** Crear un marcador para un juego de mesa o de cartas: nombre, unidad y los nombres de los jugadores. */
export default function CreateTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('puntos');
  const [lowerWins, setLowerWins] = useState(false);
  const [players, setPlayers] = useState(['', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setPlayer = (index: number, value: string) =>
    setPlayers((prev) => prev.map((current, i) => (i === index ? value : current)));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const names = players.map((player) => player.trim()).filter(Boolean);
    if (!name.trim()) return setError('Ponle nombre al marcador.');
    if (names.length < MIN_PLAYERS) return setError('Añade al menos dos jugadores.');
    if (new Set(names.map((player) => player.toLowerCase())).size !== names.length) {
      return setError('Los nombres de los jugadores no pueden repetirse.');
    }
    setError('');
    setBusy(true);
    try {
      const tracker = await createTracker({ name, unit, lowerWins, players: names });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trackers() });
      navigate(`/marcador/${tracker.id}`, { replace: true });
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo crear el marcador'));
      setBusy(false);
    }
  };

  return (
    <section className="view-section active create-league">
      <header className="create-league-header">
        <h1 className="m-0 poster-title text-[1.8rem] text-white">Nuevo marcador</h1>
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
          <label htmlFor="tracker-name">Nombre del marcador</label>
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
        <div className="create-league-field">
          <label htmlFor="tracker-unit">Qué se apunta</label>
          <input
            id="tracker-unit"
            className="glass-input"
            maxLength={20}
            autoComplete="off"
            placeholder="puntos, fichas, victorias…"
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
        <fieldset className="create-league-fieldset">
          <legend>
            Jugadores ({MIN_PLAYERS} a {MAX_PLAYERS})
          </legend>
          {players.map((player, index) => (
            <div key={index} className="create-league-field">
              <label htmlFor={`tracker-player-${index}`} className="sr-only">
                Jugador {index + 1}
              </label>
              <input
                id={`tracker-player-${index}`}
                className="glass-input"
                maxLength={40}
                autoComplete="off"
                placeholder={`Jugador ${index + 1}`}
                value={player}
                onChange={(event) => setPlayer(index, event.target.value)}
              />
            </div>
          ))}
          {players.length < MAX_PLAYERS && (
            <button
              type="button"
              className="glass-btn create-league-small-btn"
              onClick={() => setPlayers((prev) => [...prev, ''])}
            >
              Añadir jugador
            </button>
          )}
        </fieldset>
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
