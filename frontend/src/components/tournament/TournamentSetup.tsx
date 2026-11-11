import { useState } from 'react';
import type { OrganizedTournament } from '../../services/endpoints/organizedTournaments';
import type { TournamentUpdate } from './MatchEditor';
import { confirmAction } from '../../utils/confirmAction';

export default function TournamentSetup({
  tournament: t,
  update,
  busy,
}: {
  tournament: OrganizedTournament;
  update: TournamentUpdate;
  busy: boolean;
}) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('LEAGUE');
  const [draw, setDraw] = useState('RANDOM');
  const [legs, setLegs] = useState(1);
  const [win, setWin] = useState(3);
  const [drawPoints, setDrawPoints] = useState(1);
  const [loss, setLoss] = useState(0);
  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  const [round, setRound] = useState(1);
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const scheduled = t.matches.length > 0;
  const played = t.matches.some((m) => m.outcome && !m.bye);
  async function move(index: number, offset: number) {
    const ids = t.participants.map((p) => p.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    await update('order', 'PUT', { participantIds: ids });
  }
  return (
    <>
      <section
        className="paper-panel album-sheet tournament-section"
        aria-labelledby="participants-title"
      >
        <h2 id="participants-title">
          Participantes <span className="text-muted">({t.participants.length}/64)</span>
        </h2>
        {!scheduled && (
          <form
            className="tournament-inline"
            onSubmit={(event) => {
              event.preventDefault();
              void update('participants', 'POST', { name: name.trim() }).then((saved) => {
                if (saved) setName('');
              });
            }}
          >
            <label>
              Nombre del participante
              <input
                className="glass-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
              />
            </label>
            <button className="glass-btn" disabled={busy || t.participants.length >= 64}>
              Añadir
            </button>
          </form>
        )}
        {!t.participants.length && (
          <p>Añade personas, equipos o parejas. Solo necesitas sus nombres.</p>
        )}
        <ol className="tournament-participants">
          {t.participants.map((p, i) => (
            <li key={p.id}>
              <form
                className="tournament-inline"
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields = new FormData(event.currentTarget);
                  void update(`participants/${p.id}`, 'PUT', {
                    name: String(fields.get('name')).trim(),
                  });
                }}
              >
                <label className="sr-only" htmlFor={`participant-${p.id}`}>
                  Nombre de {p.name}
                </label>
                <input
                  className="glass-input"
                  id={`participant-${p.id}`}
                  name="name"
                  defaultValue={p.name}
                  required
                  maxLength={80}
                />
                <button
                  className="glass-btn"
                  disabled={busy}
                  aria-label={`Guardar nombre de ${p.name}`}
                >
                  Guardar
                </button>
              </form>
              {!scheduled && (
                <div className="tournament-actions">
                  <button
                    className="glass-btn"
                    disabled={busy || i === 0}
                    aria-label={`Subir a ${p.name}`}
                    onClick={() => void move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="glass-btn"
                    disabled={busy || i === t.participants.length - 1}
                    aria-label={`Bajar a ${p.name}`}
                    onClick={() => void move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="glass-btn"
                    disabled={busy}
                    aria-label={`Quitar a ${p.name}`}
                    onClick={() =>
                      void update(`participants/${p.id}?revision=${t.revision}`, 'DELETE')
                    }
                  >
                    Quitar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {scheduled && (
          <p>
            Para añadir o quitar participantes, borra primero el calendario. Los nombres se pueden
            corregir en cualquier momento.
          </p>
        )}
      </section>
      <section
        className="paper-panel album-sheet tournament-section"
        aria-labelledby="schedule-title"
      >
        <h2 id="schedule-title">Preparar encuentros</h2>
        {scheduled ? (
          <>
            {t.format === 'KNOCKOUT' && !played && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void update('positions', 'PUT', { firstId, secondId });
                }}
              >
                <h3>Recolocar el cuadro</h3>
                <p>
                  Intercambia dos participantes conservando los horarios. Disponible hasta que se
                  guarde el primer resultado.
                </p>
                <div className="tournament-fields">
                  <label>
                    Mover participante
                    <select
                      className="glass-input"
                      required
                      value={firstId}
                      onChange={(event) => setFirstId(event.target.value)}
                    >
                      <option value="">Seleccionar</option>
                      {t.participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Intercambiar con
                    <select
                      className="glass-input"
                      required
                      value={secondId}
                      onChange={(event) => setSecondId(event.target.value)}
                    >
                      <option value="">Seleccionar</option>
                      {t.participants
                        .filter((p) => p.id !== firstId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <button
                  className="glass-btn"
                  disabled={busy || !firstId || !secondId || firstId === secondId}
                >
                  Intercambiar posiciones
                </button>
              </form>
            )}
            <p>
              {played
                ? 'Ya hay resultados guardados. Puedes corregirlos desde cada encuentro.'
                : 'Puedes rehacer el calendario o cambiar el orden de los participantes mientras no haya resultados.'}
            </p>
            {!played && (
              <button
                className="glass-btn"
                disabled={busy}
                onClick={() =>
                  void confirmAction({
                    title: 'Rehacer calendario',
                    message:
                      'Se borrarán los cruces y horarios actuales. Los participantes se conservarán.',
                    confirmLabel: 'Borrar calendario',
                  }).then((confirmed) => {
                    if (confirmed) void update(`schedule?revision=${t.revision}`, 'DELETE');
                  })
                }
              >
                Borrar calendario y recolocar
              </button>
            )}
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void update('schedule', 'POST', {
                format,
                draw,
                legs,
                winPoints: win,
                drawPoints,
                lossPoints: loss,
              });
            }}
          >
            <div className="tournament-fields">
              <label>
                Formato
                <select
                  className="glass-input"
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                >
                  <option value="LEAGUE">Liga: todos contra todos</option>
                  <option value="KNOCKOUT">Eliminatoria</option>
                </select>
              </label>
              {format === 'LEAGUE' ? (
                <label>
                  Vueltas
                  <select
                    className="glass-input"
                    value={legs}
                    onChange={(event) => setLegs(Number(event.target.value))}
                  >
                    <option value={1}>Una vuelta</option>
                    <option value={2}>Ida y vuelta</option>
                  </select>
                </label>
              ) : (
                <label>
                  Crear cuadro
                  <select
                    className="glass-input"
                    value={draw}
                    onChange={(event) => setDraw(event.target.value)}
                  >
                    <option value="RANDOM">Sorteo aleatorio</option>
                    <option value="SEEDED">Cabezas de serie según la lista</option>
                    <option value="MANUAL">Orden manual: 1 contra 2, 3 contra 4…</option>
                  </select>
                </label>
              )}
            </div>
            {format === 'LEAGUE' ? (
              <fieldset>
                <legend>Puntos de la clasificación</legend>
                <div className="tournament-fields">
                  <label>
                    Victoria
                    <input
                      className="glass-input"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={win}
                      onChange={(event) => setWin(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Empate
                    <input
                      className="glass-input"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={drawPoints}
                      onChange={(event) => setDrawPoints(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Derrota
                    <input
                      className="glass-input"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={loss}
                      onChange={(event) => setLoss(Number(event.target.value))}
                    />
                  </label>
                </div>
              </fieldset>
            ) : (
              <p>
                Los pases libres se resuelven automáticamente. Reordena la lista antes de generar el
                cuadro para fijar los cruces o las cabezas de serie.
              </p>
            )}
            <button className="glass-btn primary-btn" disabled={busy || t.participants.length < 2}>
              Generar {format === 'LEAGUE' ? 'liga' : 'cuadro'}
            </button>
          </form>
        )}
        {t.format === 'MANUAL' && t.participants.length >= 2 && (
          <details>
            <summary>Añadir encuentros a mano</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void update('matches', 'POST', {
                  homeId,
                  awayId,
                  round,
                  scheduledAt: null,
                  venue: null,
                });
              }}
            >
              <p>Usa esta opción si ya tienes un calendario preparado.</p>
              <div className="tournament-fields">
                <label>
                  Primer participante
                  <select
                    className="glass-input"
                    required
                    value={homeId}
                    onChange={(event) => setHomeId(event.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {t.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Segundo participante
                  <select
                    className="glass-input"
                    required
                    value={awayId}
                    onChange={(event) => setAwayId(event.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {t.participants
                      .filter((p) => p.id !== homeId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Jornada o ronda
                  <input
                    className="glass-input"
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={round}
                    onChange={(event) => setRound(Number(event.target.value))}
                  />
                </label>
              </div>
              <button className="glass-btn" disabled={busy}>
                Añadir encuentro
              </button>
            </form>
          </details>
        )}
      </section>
    </>
  );
}
