import PaperLoading from '../components/PaperLoading';
import LeagueLoadState from '../components/LeagueLoadState';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { fetchCompetitionStandings, fetchCustomStandings } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { NoLeagueState, UnsupportedLeagueState } from '../components/NoLeagueState';
import type { LeagueKind } from '../context/leagueKind';
import UfcCardBoard from '../components/fightCard/UfcCardBoard';
import TennisDrawBoard from '../components/tennisDraw/TennisDrawBoard';
import FormulaOneStandings from '../components/grandPrix/FormulaOneStandings';
import { groupStandings, isLolCompetition } from '../utils/standingsGroups';
import {
  formatWinShare,
  hasNflDivisions,
  nflConferenceTables,
  nflRecord,
  NFL_PLAYOFF_SPOTS,
} from '../utils/nflStandings';

/**
 * «Tabla»: la clasificación de la competición; en la UFC, la cartelera; en el tenis, el cuadro, y en la
 * Fórmula 1, el Mundial.
 */
export default function LeagueStandings() {
  const { leagueKind, groupError } = useAppContext();
  const views: Record<LeagueKind, ReactNode> = {
    loading: <LeagueLoadState />,
    error: <LeagueLoadState error={groupError} />,
    none: <NoLeagueState title="Tabla" what="la tabla" />,
    unknown: <UnsupportedLeagueState />,
    matchday: <CompetitionTable />,
    // En la UFC no hay clasificación de equipos: la tabla es la cartelera de cada velada.
    fightCard: <UfcCardBoard />,
    // En el tenis tampoco: los «equipos» son jugadores y la tabla es el cuadro del torneo.
    tennisDraw: <TennisDrawBoard />,
    worldCup: <Navigate to="/bracket" replace />,
    customBracket: <Navigate to="/bracket" replace />,
    ownBracket: <Navigate to="/bracket" replace />,
    knockoutDraw: <Navigate to="/bracket" replace />,
    // En la Fórmula 1, el Mundial de pilotos y de constructores.
    grandPrix: <FormulaOneStandings />,
  };
  return views[leagueKind];
}

/**
 * Clasificación de la competición de la liga activa: la de una liga por jornadas o, en unas eliminatorias
 * aún sin sortear, la de su fase de liga.
 */
export function CompetitionTable() {
  const [showComplete, setShowComplete] = useState(false);
  // NFL: por divisiones (como la publica la liga) o por conferencias (la carrera a los playoffs).
  const [byConference, setByConference] = useState(false);
  const {
    activeCompetitionId,
    activeGroupId,
    activeGroupCustomCompetition,
    activeCompetitionName,
    activeCompetitionExternalId,
    activeCompetitionKnockoutCup: knockoutCup,
  } = useAppContext();

  // La NFL no da puntos: se ordena por victorias y se cuentan puntos anotados, no goles.
  const winLoss = activeCompetitionExternalId === 'nfl';
  // El LoL va por fases (play-in y suiza) con el balance de series: sin empates ni puntos de fútbol.
  const lol = isLolCompetition(activeCompetitionExternalId);
  const labels = winLoss
    ? { points: 'V-D', diff: 'Dif', for: 'PF', against: 'PC' }
    : lol
      ? { points: 'V-D', diff: 'DG', for: 'GF', against: 'GC' }
      : { points: 'PTS', diff: 'DG', for: 'GF', against: 'GC' };
  const completeColumns = 6;

  const {
    data: standings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.competitionStandings(activeCompetitionId),
    queryFn: () =>
      activeGroupCustomCompetition && activeGroupId
        ? fetchCustomStandings(Number(activeGroupId))
        : fetchCompetitionStandings(activeCompetitionId),
    enabled: Boolean(activeCompetitionId),
    staleTime: 120_000,
  });

  const rows = Array.isArray(standings) ? standings : [];
  const nflDivisions = winLoss && hasNflDivisions(rows);
  const conferences = nflDivisions && byConference;
  const groups = conferences ? nflConferenceTables(rows) : groupStandings(rows);

  return (
    <section className="standings-page paper-panel album-sheet">
      <header className="standings-head">
        <div className="standings-head-copy">
          <span className="standings-eyebrow">Clasificación</span>
          <h1 className="standings-title">{activeCompetitionName || 'Tabla de equipos'}</h1>
        </div>

        {nflDivisions && (
          <div className="standings-toggle" role="group" aria-label="Agrupar la tabla">
            <button
              type="button"
              className={byConference ? '' : 'is-active'}
              aria-pressed={!byConference}
              onClick={() => setByConference(false)}
            >
              Divisiones
            </button>
            <button
              type="button"
              className={byConference ? 'is-active' : ''}
              aria-pressed={byConference}
              onClick={() => setByConference(true)}
            >
              Conferencias
            </button>
          </div>
        )}

        {!lol && (
          <div className="standings-toggle" role="group" aria-label="Nivel de detalle de la tabla">
            <button
              type="button"
              className={showComplete ? '' : 'is-active'}
              aria-pressed={!showComplete}
              onClick={() => setShowComplete(false)}
            >
              Básica
            </button>
            <button
              type="button"
              className={showComplete ? 'is-active' : ''}
              aria-pressed={showComplete}
              onClick={() => setShowComplete(true)}
            >
              Completa
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <PaperLoading label="Cargando clasificación de equipos" embedded />
      ) : isError ? (
        <div className="standings-empty" role="alert">
          <p>No se pudo cargar la clasificación. Inténtalo de nuevo.</p>
          <button type="button" className="glass-btn" onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="paper-panel album-sheet landing-tape standings-empty">
          <p className="standings-empty-title">
            {knockoutCup
              ? 'Esta competición se juega por eliminatorias: no tiene tabla.'
              : 'No hay datos de clasificación disponibles en este momento.'}
          </p>
          <p className="standings-empty-copy">
            {knockoutCup
              ? 'Los cruces y sus resultados están en Jornadas.'
              : 'La tabla aparecerá cuando haya partidos con resultado.'}
          </p>
        </div>
      ) : (
        <div className="standings-card">
          {groups.map((group) => (
            <div key={group.title ?? 'tabla'} className="standings-group">
              {group.title && <h2 className="standings-group-title">{group.title}</h2>}
              <div className="standings-table-wrap">
                <table className={`standings-table${showComplete ? ' is-complete' : ''}`}>
                  <caption className="sr-only">
                    {group.title
                      ? `${group.title} de ${activeCompetitionName || 'la competición'}`
                      : `Clasificación de ${activeCompetitionName || 'la competición'}`}
                  </caption>
                  <colgroup>
                    <col className="standings-position-column" />
                    <col className="standings-team-column" />
                    <col className="standings-stat-column" />
                    <col className="standings-stat-column" />
                    {showComplete &&
                      Array.from({ length: completeColumns }, (_, i) => (
                        <col key={i} className="standings-stat-column" />
                      ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className="standings-pos-col">
                        #
                      </th>
                      <th scope="col">Equipo</th>
                      <th scope="col" className="standings-points-col">
                        {labels.points}
                      </th>
                      <th scope="col">{winLoss ? '%' : 'PJ'}</th>
                      {showComplete && (
                        <>
                          <th scope="col">V</th>
                          <th scope="col">{winLoss ? 'D' : 'E'}</th>
                          <th scope="col">{winLoss ? 'E' : 'D'}</th>
                          <th scope="col">{labels.diff}</th>
                          <th scope="col">{labels.for}</th>
                          <th scope="col">{labels.against}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      // En la NFL solo destaca el líder de cada división; por conferencias, ninguno: la
                      // raya marca los 7 que entran en los playoffs.
                      const podium =
                        conferences || (winLoss && row.rank !== 1)
                          ? ''
                          : row.rank >= 1 && row.rank <= 3
                            ? ` is-podium-${row.rank}`
                            : '';
                      const cutline = conferences && row.rank === NFL_PLAYOFF_SPOTS;
                      const seed =
                        winLoss &&
                        !conferences &&
                        row.playoffSeed != null &&
                        row.playoffSeed <= NFL_PLAYOFF_SPOTS
                          ? row.playoffSeed
                          : null;

                      return (
                        <tr
                          key={`${row.rank}-${row.teamName}`}
                          className={`standings-row${cutline ? ' is-playoff-cutline' : ''}`}
                        >
                          <td className="standings-rank-cell">
                            <span className={`standings-rank${podium}`}>{row.rank}</span>
                          </td>

                          <td
                            className="standings-team-cell"
                            aria-label={`Equipo: ${row.teamName}`}
                          >
                            <div className="standings-team">
                              {row.teamLogo ? (
                                <>
                                  <img
                                    src={row.teamLogo}
                                    alt=""
                                    width={28}
                                    height={28}
                                    className="standings-team-logo"
                                    loading="lazy"
                                    onError={(event) => {
                                      event.currentTarget.style.display = 'none';
                                      const fallback = event.currentTarget
                                        .nextElementSibling as HTMLElement | null;
                                      if (fallback) fallback.hidden = false;
                                    }}
                                  />
                                  <span
                                    className="standings-team-placeholder"
                                    hidden
                                    aria-hidden="true"
                                  >
                                    {row.teamName.trim().charAt(0).toLocaleUpperCase('es')}
                                  </span>
                                </>
                              ) : (
                                <span className="standings-team-placeholder" aria-hidden="true">
                                  {row.teamName.trim().charAt(0).toLocaleUpperCase('es')}
                                </span>
                              )}
                              <span className="standings-team-name">
                                {row.teamShortName ? (
                                  <>
                                    <span className="standings-team-full">{row.teamName}</span>
                                    <span className="standings-team-short">
                                      {row.teamShortName}
                                    </span>
                                  </>
                                ) : (
                                  row.teamName
                                )}
                              </span>
                              {seed != null && (
                                <span
                                  className="standings-seed"
                                  title={`Puesto ${seed} de su conferencia para los playoffs`}
                                  aria-label={`Puesto ${seed} para los playoffs`}
                                >
                                  {seed}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="standings-points-cell">
                            {winLoss
                              ? nflRecord(row)
                              : lol
                                ? `${row.wins}-${row.losses}`
                                : row.points}
                          </td>
                          <td className="standings-muted-cell">
                            {winLoss ? formatWinShare(row) : row.gamesPlayed}
                          </td>

                          {showComplete && (
                            <>
                              <td className="standings-win-cell">{row.wins}</td>
                              {winLoss ? (
                                <>
                                  <td className="standings-loss-cell">{row.losses}</td>
                                  <td className="standings-muted-cell">{row.ties}</td>
                                </>
                              ) : (
                                <>
                                  <td className="standings-muted-cell">{row.ties}</td>
                                  <td className="standings-loss-cell">{row.losses}</td>
                                </>
                              )}
                              <td
                                className={`standings-diff-cell${
                                  row.goalDiff > 0
                                    ? ' is-positive'
                                    : row.goalDiff < 0
                                      ? ' is-negative'
                                      : ''
                                }`}
                              >
                                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                              </td>
                              <td className="standings-muted-cell">{row.goalsFor}</td>
                              <td className="standings-muted-cell">{row.goalsAgainst}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {lol ? (
            <div className="standings-legend">
              <span className="standings-legend-note">
                V-D series ganadas y perdidas. Las eliminatorias no tienen tabla: sus cruces y
                resultados están en <Link to="/jornadas">Jornadas</Link>.
              </span>
            </div>
          ) : nflDivisions ? (
            <div className="standings-legend">
              <span className="standings-legend-note">
                {conferences
                  ? `Por puesto para los playoffs: entran los ${NFL_PLAYOFF_SPOTS} primeros de cada conferencia, los 4 campeones de división y 3 comodines.`
                  : 'El número junto al equipo es su puesto para los playoffs en su conferencia.'}{' '}
                V-D victorias y derrotas (y empates) · % de victorias, el empate vale media
                {showComplete && ' · Dif diferencia de puntos · PF y PC puntos a favor y en contra'}
              </span>
            </div>
          ) : showComplete ? (
            <div className="standings-legend">
              <span className="standings-legend-note">
                {winLoss
                  ? `V victorias · D derrotas · E empates · Dif diferencia de puntos · PF y PC puntos a favor y en contra`
                  : 'V victorias · E empates · D derrotas · DG diferencia de marcador'}
              </span>
            </div>
          ) : (
            <div className="standings-footer">
              <span>Vista rápida de la clasificación.</span>
              <button
                type="button"
                className="standings-link"
                onClick={() => setShowComplete(true)}
              >
                Ver tabla completa →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
