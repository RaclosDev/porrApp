import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createTracker } from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import { scoreboardPath } from '../utils/scoreboardLeague';

export default function CreateTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Ponle nombre al marcador.');
    setError('');
    setBusy(true);
    try {
      const tracker = await createTracker({ name: name.trim() });
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
        <h1 className="m-0 poster-title text-[1.8rem] text-white">Marcadores de juegos</h1>
        <p className="create-league-progress">
          Un grupo para llevar la cuenta de todos los juegos a los que juguéis.
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
            placeholder="Por ejemplo: Gym o Los del viernes"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <p className="create-league-hint">
          Cada día eliges quién ha venido y a qué jugáis. Puedes usar juegos preparados o añadir
          cualquiera con su nombre y sus reglas de puntuación. Las partidas se guardan por día y
          suman al ranking general y al de cada juego.
        </p>

        <p className="create-league-hint">
          Desde el grupo puedes compartir un QR o un enlace para invitar a tus amigos; cada uno
          aparecerá como jugador al entrar.
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
