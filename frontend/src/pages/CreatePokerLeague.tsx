import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createPokerLeague } from '../services/endpoints/poker';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';

export default function CreatePokerLeague() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [creationKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Ponle nombre a la liga.');
    setBusy(true);
    setError('');
    try {
      const league = await createPokerLeague(name.trim(), creationKey);
      await client.invalidateQueries({ queryKey: queryKeys.myGroups() });
      navigate(`/?group=${league.id}`, { replace: true });
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo crear la liga de póker.'));
      setBusy(false);
    }
  }

  return (
    <section className="view-section active create-league">
      <header className="create-league-header">
        <h1 className="m-0 poster-title text-[1.8rem] text-white">Crear liga de póker</h1>
        <p className="create-league-progress">
          Reúne al grupo y organiza vuestros torneos de Texas Hold’em.
        </p>
      </header>
      <form
        className="paper-panel album-sheet create-league-sheet"
        onSubmit={(event) => void submit(event)}
      >
        <div className="create-league-field">
          <label htmlFor="poker-league-name">Nombre de la liga</label>
          <input
            id="poker-league-name"
            className="glass-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Por ejemplo, Póker de los sábados"
            required
            maxLength={60}
            autoComplete="off"
          />
        </div>
        {error && (
          <p className="create-league-error is-block" role="alert">
            {error}
          </p>
        )}
        <div className="create-league-nav">
          <Link to="/crear-liga" className="glass-btn create-league-nav-btn">
            Volver
          </Link>
          <button
            type="submit"
            className="glass-btn primary-btn create-league-nav-btn is-primary"
            disabled={busy}
          >
            {busy ? 'Creando…' : 'Crear liga'}
          </button>
        </div>
      </form>
    </section>
  );
}
