import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createOrganizedTournament } from '../services/endpoints/organizedTournaments';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import '../styles/organized-tournament.css';

export default function CreateTournament() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [creationKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('');
  const [activity, setActivity] = useState('');
  const [participantType, setParticipantType] = useState('INDIVIDUAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const tournament = await createOrganizedTournament({
        name: name.trim(),
        activity: activity.trim(),
        participantType,
        creationKey,
      });
      await client.invalidateQueries({ queryKey: queryKeys.myGroups() });
      navigate(`/torneos/${tournament.id}`, { replace: true });
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo crear el torneo.'));
      setBusy(false);
    }
  }
  return (
    <section className="view-section active tournament-page">
      <Link to="/mis-ligas">← Mis ligas</Link>
      <header>
        <h1 className="poster-title">Organizar un torneo</h1>
        <p>
          Añade participantes, prepara los encuentros y publica los resultados. Tú lo administras y
          cualquiera puede seguirlo con un enlace.
        </p>
      </header>
      <form
        className="paper-panel album-sheet tournament-section"
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Nombre del torneo
          <input
            className="glass-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            autoComplete="off"
          />
        </label>
        <label>
          Deporte o juego
          <input
            className="glass-input"
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
            required
            maxLength={80}
            placeholder="Por ejemplo, fútbol, petanca o Pokémon TCG"
          />
        </label>
        <label>
          Participan
          <select
            className="glass-input"
            value={participantType}
            onChange={(event) => setParticipantType(event.target.value)}
          >
            <option value="INDIVIDUAL">Personas</option>
            <option value="TEAM">Equipos</option>
            <option value="PAIR">Parejas</option>
          </select>
        </label>
        <p>
          Los participantes no necesitan cuenta. El torneo empieza en borrador: se podrá consultar
          cuando lo publiques.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="glass-btn primary-btn" disabled={busy}>
          {busy ? 'Creando…' : 'Crear torneo'}
        </button>
      </form>
    </section>
  );
}
