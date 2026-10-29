import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { fetchCompetitionStandings } from '../services/api';

const ZONE_LABELS = {
  champions: 'Zona Champions League',
  europa: 'Zona Europa League',
  relegation: 'Zona de descenso',
};

export default function LeagueStandings() {
  const [showComplete, setShowComplete] = useState(false);

  const {
    activeCompetitionId,
    activeCompetitionName,
    activeCompetitionFormatType,
    activeGroupPoolFormat,
    loadingGroup,
    groupError,
  } = useAppContext();

  const isMatchDay =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  const {
    data: standings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['competitionStandings', activeCompetitionId],
    queryFn: () => fetchCompetitionStandings(activeCompetitionId),
    enabled: Boolean(activeCompetitionId && isMatchDay),
    staleTime: 120_000,
  });

  if (loadingGroup) return <p role="status">Cargando liga...</p>;
  if (groupError) return <p role="alert">No se pudo cargar la liga. Inténtalo de nuevo.</p>;
  if (activeCompetitionFormatType && !isMatchDay) {
    return <Navigate to="/bracket" replace />;
  }

  return (
    <section className="standings-page">
      <header className="standings-head">
        <div className="standings-head-copy">
          <span className="standings-eyebrow">Clasificación</span>
          <h1 className="standings-title">{activeCompetitionName || 'Tabla de equipos'}</h1>
        </div>

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
      </header>

      {isLoading ? (
        <div className="standings-skeleton" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="skeleton-card standings-skeleton-row" />
          ))}
        </div>
      ) : isError || !standings || !Array.isArray(standings) || standings.length === 0 ? (
        <div className="glass-panel standings-empty">
          <div className="standings-empty-icon" aria-hidden="true">
            📊
          </div>
          <p className="standings-empty-title">
            No hay datos de clasificación disponibles en este momento.
          </p>
          <p className="standings-empty-copy">
            Los datos se sincronizarán en cuanto se disputen los partidos de la temporada.
          </p>
        </div>
      ) : (
        <div className="standings-card">
          <div className="standings-table-wrap">
            <table className={`standings-table${showComplete ? ' is-complete' : ''}`}>
              <caption className="sr-only">
                Clasificación de {activeCompetitionName || 'la competición'}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="standings-pos-col">
                    #
                  </th>
                  <th scope="col">Equipo</th>
                  <th scope="col" className="standings-points-col">
                    PTS
                  </th>
                  <th scope="col">PJ</th>
                  {showComplete && (
                    <>
                      <th scope="col">V</th>
                      <th scope="col">E</th>
                      <th scope="col">D</th>
                      <th scope="col">DG</th>
                      <th scope="col">GF</th>
                      <th scope="col">GC</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const zone =
                    row.rank >= 1 && row.rank <= 4
                      ? 'champions'
                      : row.rank >= 5 && row.rank <= 6
                        ? 'europa'
                        : row.rank >= 18
                          ? 'relegation'
                          : null;
                  const podium = row.rank >= 1 && row.rank <= 3 ? ` is-podium-${row.rank}` : '';

                  return (
                    <tr
                      key={`${row.rank}-${row.teamName}`}
                      className={`standings-row${zone ? ` is-${zone}` : ''}`}
                    >
                      <td className="standings-rank-cell">
                        <span
                          className={`standings-rank${podium}`}
                          title={zone ? ZONE_LABELS[zone] : undefined}
                        >
                          {row.rank}
                        </span>
                      </td>

                      <td className="standings-team-cell" aria-label={`Equipo: ${row.teamName}`}>
                        <div className={`standings-team${showComplete ? ' is-crest-only' : ''}`}>
                          {row.teamLogo ? (
                            <>
                              <img
                                src={row.teamLogo}
                                alt={showComplete ? row.teamName : ''}
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
                                🛡️
                              </span>
                            </>
                          ) : (
                            <span className="standings-team-placeholder" aria-hidden="true">
                              🛡️
                            </span>
                          )}
                          {!showComplete && (
                            <span className="standings-team-name">{row.teamName}</span>
                          )}
                        </div>
                      </td>

                      <td className="standings-points-cell">{row.points}</td>
                      <td className="standings-muted-cell">{row.gamesPlayed}</td>

                      {showComplete && (
                        <>
                          <td className="standings-win-cell">{row.wins}</td>
                          <td className="standings-muted-cell">{row.ties}</td>
                          <td className="standings-loss-cell">{row.losses}</td>
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

          {showComplete ? (
            <div className="standings-legend">
              <span className="standings-legend-item">
                <i className="is-champions" aria-hidden="true" />
                Champions League
              </span>
              <span className="standings-legend-item">
                <i className="is-europa" aria-hidden="true" />
                Europa League
              </span>
              <span className="standings-legend-item">
                <i className="is-relegation" aria-hidden="true" />
                Descenso
              </span>
              <span className="standings-legend-note">
                V victorias · E empates · D derrotas · DG diferencia de goles
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
