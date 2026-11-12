import { useState } from 'react';
import type { PokerSession } from '../../services/endpoints/poker';
import { PokerAvatar } from './PokerFaces';
import PokerPodium from './PokerPodium';
import {
  chips,
  euros,
  percent,
  pokerStandings,
  shortDate,
  signedEuros,
  standingLabel,
  tournamentDate,
} from './pokerFormat';

function Net({ cents }: { cents: number }) {
  return (
    <td className={cents > 0 ? 'poker-net is-up' : cents < 0 ? 'poker-net is-down' : 'poker-net'}>
      {signedEuros(cents)}
    </td>
  );
}

export function PokerHistory({ sessions }: { sessions: PokerSession[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Orden cronológico, como las jornadas: «anterior» lleva al torneo más antiguo.
  const ordered = [...sessions].reverse();
  const found = ordered.findIndex((session) => session.id === selectedId);
  const index = found === -1 ? ordered.length - 1 : found;
  const session = ordered[index];

  return (
    <section className="paper-panel album-sheet poker-panel">
      <h2>Histórico de torneos</h2>
      {!session ? (
        <p className="poker-note">Los torneos aparecerán aquí al cerrarlos.</p>
      ) : (
        <>
          <div className="md-round-bar poker-round-bar">
            <button
              type="button"
              className="glass-btn md-round-step"
              onClick={() => setSelectedId(ordered[index - 1].id)}
              disabled={index === 0}
              aria-label="Torneo anterior"
            >
              ‹
            </button>
            <select
              className="md-round-select"
              value={session.id}
              onChange={(event) => setSelectedId(Number(event.target.value))}
              aria-label="Seleccionar torneo"
            >
              {ordered.map((item, position) => (
                <option key={item.id} value={item.id}>
                  Torneo {position + 1} · {shortDate(item.date)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="glass-btn md-round-step"
              onClick={() => setSelectedId(ordered[index + 1].id)}
              disabled={index === ordered.length - 1}
              aria-label="Torneo siguiente"
            >
              ›
            </button>
          </div>
          <p className="poster-title poker-big-date">{tournamentDate(session.date)}</p>
          <p className="poker-note">
            {session.results.length} jugadores · {euros(session.potCents)} de bote ·{' '}
            {euros(session.settings.buyInCents)} de entrada ·{' '}
            {chips(session.settings.startingChips)} fichas iniciales
          </p>
          <PokerPodium
            label="Podio del torneo"
            places={session.results.slice(0, 3).map((result) => ({
              playerId: result.playerId,
              place: result.place,
              name: result.name,
              value: result.prizeCents > 0 ? euros(result.prizeCents) : 'Sin premio',
            }))}
          />
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
                  <th scope="col">Fichas finales</th>
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
                      <span className="poker-player">
                        <PokerAvatar playerId={result.playerId} name={result.name} size={28} />
                        <span>
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
                        </span>
                      </span>
                    </th>
                    <td>{result.finalChips == null ? '—' : chips(result.finalChips)}</td>
                    <td>{euros(result.paidCents)}</td>
                    <td>{euros(result.prizeCents)}</td>
                    <Net cents={result.prizeCents - result.paidCents} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

type Standing = ReturnType<typeof pokerStandings>[number];
const statisticColumns: { label: string; value: (row: Standing) => number | string }[] = [
  { label: 'Jugador', value: (row) => row.name },
  { label: 'Torneos', value: (row) => row.played },
  { label: 'Recompras', value: (row) => row.rebuys },
  { label: 'Add-ons', value: (row) => row.addOns },
  { label: 'Victorias', value: (row) => row.wins },
  { label: '% victorias', value: (row) => row.wins / row.played },
  { label: 'Podios', value: (row) => row.podiums },
  { label: '% con premio', value: (row) => row.cashes / row.played },
  { label: 'Puesto medio', value: (row) => row.places / row.played },
  { label: 'Premios', value: (row) => row.prizes },
  { label: 'Neto', value: (row) => row.prizes - row.paid },
];

export function PokerStatistics({ sessions }: { sessions: PokerSession[] }) {
  const standings = pokerStandings(sessions);
  const [sort, setSort] = useState<{ column: number; ascending: boolean } | null>(null);
  const sorted = [...standings];
  if (sort) {
    const { value } = statisticColumns[sort.column];
    sorted.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const comparison =
        typeof left === 'string' && typeof right === 'string'
          ? left.localeCompare(right, 'es', { sensitivity: 'base' })
          : Number(left) - Number(right);
      return (
        (sort.ascending ? comparison : -comparison) ||
        a.name.localeCompare(b.name, 'es') ||
        a.playerId - b.playerId
      );
    });
  }
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
          <PokerPodium
            label="Podio de la liga por victorias"
            places={standings.slice(0, 3).map((row) => ({
              playerId: row.playerId,
              name: row.name,
              value: standingLabel(row),
            }))}
          />
          <div
            className="poker-table-scroll"
            role="region"
            aria-label="Clasificación de la liga de póker"
            tabIndex={0}
          >
            <table className="poker-table">
              <thead>
                <tr>
                  {statisticColumns.map((column, index) => (
                    <th
                      key={column.label}
                      scope="col"
                      aria-sort={
                        sort?.column === index
                          ? sort.ascending
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        type="button"
                        className="poker-sort"
                        onClick={() =>
                          setSort((previous) => ({
                            column: index,
                            ascending:
                              previous?.column === index ? !previous.ascending : index === 0,
                          }))
                        }
                      >
                        {column.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.playerId}>
                    <th scope="row">
                      <span className="poker-player">
                        <PokerAvatar playerId={row.playerId} name={row.name} size={28} />
                        {row.name}
                      </span>
                    </th>
                    <td>{row.played}</td>
                    <td>{row.rebuys}</td>
                    <td>{row.addOns}</td>
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
            descuenta entradas, recompras y add-ons. Las recompras y los add-ons acumulan las
            compras de cada jugador en los torneos cerrados.
          </p>
        </>
      )}
    </section>
  );
}
