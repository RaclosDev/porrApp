import type { PokerSession } from '../../services/endpoints/poker';
import { chips, euros, percent, pokerStandings, signedEuros, tournamentDate } from './pokerFormat';

function Net({ cents }: { cents: number }) {
  return (
    <td className={cents > 0 ? 'poker-net is-up' : cents < 0 ? 'poker-net is-down' : 'poker-net'}>
      {signedEuros(cents)}
    </td>
  );
}

export function PokerHistory({ sessions }: { sessions: PokerSession[] }) {
  return (
    <section className="paper-panel album-sheet poker-panel">
      <h2>Histórico de torneos</h2>
      {sessions.length === 0 && (
        <p className="poker-note">Los torneos aparecerán aquí al cerrarlos.</p>
      )}
      {sessions.map((session, index) => (
        <details
          className="poker-details poker-result"
          key={session.id}
          open={index === 0 || undefined}
        >
          <summary>
            <span className="inline-block first-letter:uppercase">
              {tournamentDate(session.date)}
            </span>
            <span className="poker-note">
              Ganó {session.results[0]?.name} · {session.results.length} jugadores ·{' '}
              {euros(session.potCents)} de bote
            </span>
          </summary>
          <div className="poker-detail-content">
            <p className="poker-note">
              {euros(session.settings.buyInCents)} de entrada ·{' '}
              {chips(session.settings.startingChips)} fichas iniciales
            </p>
            <div
              className="poker-table-scroll"
              role="region"
              aria-label={`Resultados del ${tournamentDate(session.date)}`}
              tabIndex={0}
            >
              <table className="poker-table poker-results-table">
                <thead>
                  <tr>
                    <th scope="col">Puesto</th>
                    <th scope="col">Jugador</th>
                    <th scope="col">Aportado</th>
                    <th scope="col">Premio</th>
                    <th scope="col">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {session.results.map((result) => (
                    <tr key={result.playerId}>
                      <td>{result.place}.º</td>
                      <th scope="row">
                        {result.name}
                        {(result.rebuys > 0 || result.addOns > 0) && (
                          <small>
                            {[
                              result.rebuys > 0 &&
                                `${result.rebuys} ${result.rebuys === 1 ? 'recompra' : 'recompras'}`,
                              result.addOns > 0 &&
                                `${result.addOns} ${result.addOns === 1 ? 'extra' : 'extras'}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                        )}
                      </th>
                      <td>{euros(result.paidCents)}</td>
                      <td>{euros(result.prizeCents)}</td>
                      <Net cents={result.prizeCents - result.paidCents} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ))}
    </section>
  );
}

export function PokerStatistics({ sessions }: { sessions: PokerSession[] }) {
  const standings = pokerStandings(sessions);
  const formatPlace = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  return (
    <section className="paper-panel album-sheet poker-panel">
      <h2>Estadísticas de la liga</h2>
      {standings.length === 0 ? (
        <p className="poker-note">Las estadísticas se calculan al cerrar el primer torneo.</p>
      ) : (
        <>
          <p className="poker-note">
            {sessions.length} {sessions.length === 1 ? 'torneo cerrado' : 'torneos cerrados'} ·{' '}
            {standings.length} jugadores
          </p>
          <div
            className="poker-table-scroll"
            role="region"
            aria-label="Clasificación de la liga de póker"
            tabIndex={0}
          >
            <table className="poker-table">
              <thead>
                <tr>
                  <th scope="col">Jugador</th>
                  <th scope="col">Torneos</th>
                  <th scope="col">Victorias</th>
                  <th scope="col">% victorias</th>
                  <th scope="col">Podios</th>
                  <th scope="col">% con premio</th>
                  <th scope="col">Puesto medio</th>
                  <th scope="col">Premios</th>
                  <th scope="col">Neto</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.playerId}>
                    <th scope="row">{row.name}</th>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{percent(row.wins / row.played)}</td>
                    <td>{row.podiums}</td>
                    <td>{percent(row.cashes / row.played)}</td>
                    <td>{formatPlace.format(row.places / row.played)}.º</td>
                    <td>{euros(row.prizes)}</td>
                    <Net cents={row.prizes - row.paid} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="poker-note">
            Los porcentajes se calculan sobre los torneos jugados por cada persona. El neto
            descuenta entradas, recompras y extras.
          </p>
        </>
      )}
    </section>
  );
}
